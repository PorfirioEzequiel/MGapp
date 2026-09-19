import React, { useEffect, useState } from "react";
import supabase, { supabaseStorage as supabaseAdmin } from "../supabase/client";
import { useNavigate } from "react-router-dom";

const fmtFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const badgeStatus = (s) => {
  const m = {
    PENDIENTE:  "bg-amber-100 text-amber-800",
    ENTREGADO:  "bg-emerald-100 text-emerald-800",
    CANCELADO:  "bg-red-100 text-red-700",
  };
  return m[s] ?? "bg-slate-100 text-slate-600";
};

const OPCIONES_PAGO = [
  { v: "CONTADO", label: "Contado" },
  { v: "1_MES",   label: "1 mes"   },
  { v: "2_MESES", label: "2 meses" },
];

export default function SolicitudesApoyos() {
  const navigate = useNavigate();

  const [programas,     setProgramas]     = useState([]);
  const [progFiltro,    setProgFiltro]    = useState("todos");
  const [statusFiltro,  setStatusFiltro]  = useState("todos");
  const [sinPagoFiltro, setSinPagoFiltro] = useState(false);
  const [busqueda,      setBusqueda]      = useState("");
  const [registros,     setRegistros]     = useState([]);
  const [cargando,      setCargando]      = useState(false);
  const [smNombres,     setSmNombres]     = useState({});
  const [guardandoPago, setGuardandoPago] = useState(null);

  // Cargar programas para el filtro (supabaseAdmin bypasses RLS)
  useEffect(() => {
    supabaseAdmin
      .from("programas_sociales")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setProgramas(data ?? []));
  }, []);

  // Cargar registros cuando cambia el filtro de programa
  useEffect(() => {
    setCargando(true);
    let q = supabaseAdmin
      .from("apoyo_entregas")
      .select(`
        id,
        cantidad,
        status,
        periodo,
        created_at,
        forma_pago,
        ciudadania:beneficiario_id (
          id, nombre, a_paterno, a_materno, curp, telefono_1,
          seccion, ubt, movilizador, poligono
        ),
        programas_sociales:programa_id (id, nombre)
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (progFiltro !== "todos") q = q.eq("programa_id", progFiltro);
    if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);

    q.then(({ data, error }) => {
      if (!error) {
        const lista = data ?? [];
        setRegistros(lista);
        // Cargar nombres completos de las SM referenciadas
        const usuarios = [...new Set(lista.map((r) => r.ciudadania?.movilizador).filter(Boolean))];
        if (usuarios.length > 0) {
          supabaseAdmin
            .from("ciudadania")
            .select("usuario, nombre, a_paterno, a_materno")
            .in("usuario", usuarios)
            .then(({ data: sms }) => {
              const mapa = {};
              (sms ?? []).forEach((sm) => {
                mapa[sm.usuario] = `${sm.nombre ?? ""} ${sm.a_paterno ?? ""} ${sm.a_materno ?? ""}`.trim();
              });
              setSmNombres(mapa);
            });
        } else {
          setSmNombres({});
        }
      }
      setCargando(false);
    });
  }, [progFiltro, statusFiltro]);

  const actualizarFormaPago = async (id, valor) => {
    setGuardandoPago(id);
    const { error } = await supabaseAdmin
      .from("apoyo_entregas")
      .update({ forma_pago: valor })
      .eq("id", id);
    if (!error) {
      setRegistros((prev) =>
        prev.map((r) => (r.id === id ? { ...r, forma_pago: valor } : r))
      );
    }
    setGuardandoPago(null);
  };

  // Filtro de búsqueda en cliente
  const busqLower = busqueda.toLowerCase().trim();
  const filtrados = registros.filter((r) => {
    if (sinPagoFiltro && r.forma_pago) return false;
    if (!busqLower) return true;
    const c = r.ciudadania;
    if (!c) return false;
    const nombre = `${c.nombre} ${c.a_paterno} ${c.a_materno}`.toLowerCase();
    return (
      nombre.includes(busqLower) ||
      (c.curp ?? "").toLowerCase().includes(busqLower) ||
      (c.telefono_1 ?? "").includes(busqLower) ||
      String(c.seccion ?? "").includes(busqLower) ||
      (c.movilizador ?? "").toLowerCase().includes(busqLower)
    );
  });

  // Totales por estatus para el encabezado
  const totPendiente = filtrados.filter((r) => r.status === "PENDIENTE").length;
  const totEntregado = filtrados.filter((r) => r.status === "ENTREGADO").length;
  const totSinPago   = registros.filter(
    (r) => r.programas_sociales?.nombre?.toLowerCase().includes("calentador") && !r.forma_pago
  ).length;

  const descargarCSV = () => {
    const cols = ["Nombre", "Teléfono", "Sector", "Sección", "Fracción", "SM", "Cantidad", "Apoyo", "Pago"];
    const filas = filtrados.map((r) => {
      const c = r.ciudadania;
      const nombre = c ? `${c.nombre ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim() : "";
      const smNombre = c?.movilizador ? (smNombres[c.movilizador] || c.movilizador) : "";
      return [
        nombre,
        c?.telefono_1 ?? "",
        c?.poligono ?? "",
        c?.seccion ?? "",
        c?.ubt ?? "",
        smNombre,
        r.cantidad ?? 1,
        r.programas_sociales?.nombre ?? "",
        r.forma_pago ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [cols.join(","), ...filas].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apoyos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Admin</p>
            <h1 className="text-xl font-black tracking-tight">Solicitudes de Apoyos</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-44">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Programa
            </label>
            <select
              value={progFiltro}
              onChange={(e) => setProgFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400"
            >
              <option value="todos">Todos los programas</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="min-w-36">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Estatus
            </label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400"
            >
              <option value="todos">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
          <div className="flex-1 min-w-52">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, CURP, teléfono, sección..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="self-end flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSinPagoFiltro((v) => !v);
                if (!sinPagoFiltro) {
                  const calentadorId = programas.find((p) =>
                    p.nombre.toLowerCase().includes("calentador")
                  )?.id;
                  if (calentadorId) setProgFiltro(String(calentadorId));
                } else {
                  setProgFiltro("todos");
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                sinPagoFiltro
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              }`}
            >
              {sinPagoFiltro ? "✕ " : ""}Sin forma de pago
              {totSinPago > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${sinPagoFiltro ? "bg-white text-red-600" : "bg-red-600 text-white"}`}>
                  {totSinPago}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={descargarCSV}
              disabled={filtrados.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Descargar CSV
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",          val: filtrados.length, color: "bg-white border-slate-200 text-slate-800" },
            { label: "Pendientes",     val: totPendiente,     color: "bg-amber-50 border-amber-200 text-amber-800" },
            { label: "Entregados",     val: totEntregado,     color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
            { label: "Sin forma pago", val: totSinPago,       color: totSinPago > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200 text-slate-400" },
          ].map((k) => (
            <div key={k.label} className={`rounded-2xl border px-4 py-3 ${k.color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{k.label}</p>
              <p className="text-2xl font-black mt-0.5">{k.val}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="flex items-center gap-3 px-6 py-10">
              <div className="w-5 h-5 rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin" />
              <span className="text-sm text-slate-500">Cargando registros...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-slate-400 text-sm">No hay registros con los filtros actuales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-left">Ciudadano</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">CURP</th>
                    <th className="px-4 py-3 text-left">Programa</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    <th className="px-4 py-3 text-left">Forma de pago</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Sec. / Fracc.</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">SM asignada</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Fecha</th>
                    <th className="px-4 py-3 text-center">Estatus</th>
                    <th className="px-4 py-3 text-center">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtrados.map((r) => {
                    const c = r.ciudadania;
                    const nombre = c
                      ? `${c.nombre ?? ""} ${c.a_paterno ?? ""} ${c.a_materno ?? ""}`.trim()
                      : "—";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 leading-tight">{nombre}</p>
                          {c?.telefono_1 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{c.telefono_1}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-[11px] text-slate-500">{c?.curp ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-700 font-semibold">
                            {r.programas_sociales?.nombre ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-black text-slate-800">{r.cantidad ?? 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.programas_sociales?.nombre?.toLowerCase().includes("calentador") ? (
                            <select
                              value={r.forma_pago ?? ""}
                              onChange={(e) => e.target.value && actualizarFormaPago(r.id, e.target.value)}
                              disabled={guardandoPago === r.id}
                              className={`text-xs px-2 py-1.5 rounded-lg border font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${
                                !r.forma_pago
                                  ? "border-red-300 bg-red-50 text-red-700"
                                  : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <option value="">⚠ Sin pago</option>
                              {OPCIONES_PAGO.map((o) => (
                                <option key={o.v} value={o.v}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-slate-500 text-xs">
                            {c?.seccion ?? "—"} / {c?.ubt ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-500 text-xs">{c?.movilizador ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-400">{fmtFecha(r.created_at)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${badgeStatus(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c?.id ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/ciudadano/${c.id}`)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                            >
                              Ficha
                            </button>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtrados.length > 0 && (
          <p className="text-[11px] text-slate-400 text-right pr-1">
            Mostrando {filtrados.length} de {registros.length} registros
          </p>
        )}
      </main>
    </div>
  );
}
