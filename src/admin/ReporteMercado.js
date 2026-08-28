import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseStorage as supabaseAdmin } from "../supabase/client";

// ── Helpers ────────────────────────────────────────────────────────────────────
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const badgePct = (p) => {
  if (p >= 100) return "bg-emerald-100 text-emerald-800";
  if (p >= 80)  return "bg-blue-100 text-blue-800";
  if (p >= 50)  return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
};

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReporteMercado() {
  const navigate = useNavigate();

  const [datos,    setDatos]    = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroEntrega, setFiltroEntrega] = useState("todos");
  const [filtroSector,  setFiltroSector]  = useState("todos");
  const [filtroMes,     setFiltroMes]     = useState("todos");

  // Cargar todo de una sola vez (2208 filas — manejable en memoria)
  useEffect(() => {
    setCargando(true);
    supabaseAdmin
      .from("mercado")
      .select("entrega,mes,año,fecha_entrega,sector,coordinador,fracciones,sm_activas,piezas,total,entregadas,estatus,nombre,camioneta_repartidor,numero_viaje")
      .order("entrega", { ascending: true })
      .order("sector",  { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) console.error("Error cargando mercado:", error.message);
        setDatos(data ?? []);
        setCargando(false);
      });
  }, []);

  // Opciones de filtro derivadas de los datos
  const entregas = useMemo(() => [...new Set(datos.map((r) => r.entrega).filter(Boolean))].sort((a, b) => a - b), [datos]);
  const sectores = useMemo(() => [...new Set(datos.map((r) => r.sector).filter(Boolean))].sort((a, b) => a - b), [datos]);
  const meses    = useMemo(() => [...new Set(datos.map((r) => (r.mes ?? "").trim()).filter(Boolean))].sort(), [datos]);

  // Datos filtrados
  const filtrados = useMemo(() => {
    return datos.filter((r) => {
      if (filtroEntrega !== "todos" && String(r.entrega) !== filtroEntrega) return false;
      if (filtroSector  !== "todos" && String(r.sector)  !== filtroSector)  return false;
      if (filtroMes     !== "todos" && (r.mes ?? "").trim() !== filtroMes)   return false;
      return true;
    });
  }, [datos, filtroEntrega, filtroSector, filtroMes]);

  // Fechas de entrega para el encabezado
  const fechasEntrega = useMemo(() =>
    [...new Set(filtrados.map((r) => r.fecha_entrega).filter(Boolean))].sort(),
    [filtrados]
  );

  // ── Agrupación sector → coordinador ──────────────────────────────────────────
  const tablaAgrupada = useMemo(() => {
    // Acumula por sector → coordinador
    const mapa = new Map(); // "sector|coord" → acumulador
    for (const r of filtrados) {
      const sec   = r.sector ?? 0;
      const coord = (r.coordinador ?? "—").trim() || "—";
      const key   = `${sec}|${coord}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          sector:      sec,
          coordinador: coord,
          paradas:     0,
          sm_activas:  0,
          fracciones:  0,
          total:       0,
          entregadas:  0,
          pendientes:  0,
        });
      }
      const a = mapa.get(key);
      a.paradas    += 1;
      a.sm_activas += num(r.sm_activas);
      a.fracciones += num(r.fracciones);
      a.total      += num(r.total);
      a.entregadas += num(r.entregadas);
      a.pendientes += (r.estatus === "PENDIENTE" ? 1 : 0);
    }

    // Ordenar por sector, luego coordinador
    const filas = [...mapa.values()].sort((a, b) =>
      a.sector !== b.sector ? a.sector - b.sector : a.coordinador.localeCompare(b.coordinador)
    );

    // Agregar subtotales por sector
    const resultado = [];
    let sectorActual = null;
    let subTotal = null;

    const vacioSub = () => ({ es_subtotal: true, paradas: 0, sm_activas: 0, fracciones: 0, total: 0, entregadas: 0, pendientes: 0 });

    for (const f of filas) {
      if (f.sector !== sectorActual) {
        if (subTotal) resultado.push(subTotal);
        sectorActual = f.sector;
        subTotal = { ...vacioSub(), sector: sectorActual, coordinador: `TOTAL SECTOR ${sectorActual}` };
      }
      resultado.push(f);
      subTotal.paradas    += f.paradas;
      subTotal.sm_activas += f.sm_activas;
      subTotal.fracciones += f.fracciones;
      subTotal.total      += f.total;
      subTotal.entregadas += f.entregadas;
      subTotal.pendientes += f.pendientes;
    }
    if (subTotal) resultado.push(subTotal);
    return resultado;
  }, [filtrados]);

  // Gran total
  const granTotal = useMemo(() => ({
    paradas:    tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.paradas, 0),
    sm_activas: tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.sm_activas, 0),
    fracciones: tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.fracciones, 0),
    total:      tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.total, 0),
    entregadas: tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.entregadas, 0),
    pendientes: tablaAgrupada.filter((r) => !r.es_subtotal).reduce((s, r) => s + r.pendientes, 0),
  }), [tablaAgrupada]);

  // ── KPIs globales ─────────────────────────────────────────────────────────────
  const totalFilas      = filtrados.length;
  const totalEntregadas = granTotal.entregadas;
  const totalPedido     = granTotal.total;
  const avance          = pct(totalEntregadas, totalPedido);

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-blue-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Mercado Solidario</p>
            <h1 className="text-xl font-black tracking-tight">Reporte de Entregas</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/importar-mercado")}
            className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition-all duration-150 whitespace-nowrap"
          >
            ↑ Importar CSV
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-36">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Entrega</label>
            <select value={filtroEntrega} onChange={(e) => setFiltroEntrega(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400">
              <option value="todos">Todas</option>
              {entregas.map((e) => <option key={e} value={String(e)}>Entrega {e}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Mes</label>
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400">
              <option value="todos">Todos</option>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sector</label>
            <select value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400">
              <option value="todos">Todos</option>
              {sectores.map((s) => <option key={s} value={String(s)}>Sector {s}</option>)}
            </select>
          </div>
          {fechasEntrega.length > 0 && (
            <div className="flex-1 min-w-48">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fechas de entrega</p>
              <p className="text-sm font-semibold text-slate-700">{fechasEntrega.join("  ·  ")}</p>
            </div>
          )}
        </div>

        {/* ── KPIs ── */}
        {!cargando && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Paradas",    val: granTotal.paradas.toLocaleString(),    color: "bg-white border-slate-200 text-slate-800" },
              { label: "SM Activas", val: granTotal.sm_activas.toLocaleString(), color: "bg-white border-slate-200 text-slate-800" },
              { label: "Pedido",     val: granTotal.total.toLocaleString(),      color: "bg-blue-50 border-blue-200 text-blue-900" },
              { label: "Entregado",  val: granTotal.entregadas.toLocaleString(), color: "bg-emerald-50 border-emerald-200 text-emerald-900" },
            ].map((k) => (
              <div key={k.label} className={`rounded-2xl border px-4 py-3 ${k.color}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{k.label}</p>
                <p className="text-2xl font-black mt-0.5">{k.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Barra de avance global */}
        {!cargando && totalPedido > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-700">Avance global de entrega</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgePct(avance)}`}>{avance}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(avance, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {totalEntregadas.toLocaleString()} entregadas de {totalPedido.toLocaleString()} pedidas
              {granTotal.pendientes > 0 && ` · ${granTotal.pendientes} paradas pendientes`}
            </p>
          </div>
        )}

        {/* ── Tabla por sector / coordinador ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="flex items-center gap-3 px-6 py-10">
              <div className="w-5 h-5 rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin" />
              <span className="text-sm text-slate-500">Cargando datos...</span>
            </div>
          ) : tablaAgrupada.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-slate-400 text-sm">Sin datos con los filtros actuales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                    <th className="px-4 py-3 text-center">Sector</th>
                    <th className="px-4 py-3 text-left">Coordinador</th>
                    <th className="px-4 py-3 text-center">Paradas</th>
                    <th className="px-4 py-3 text-center">SM Activas</th>
                    <th className="px-4 py-3 text-center">Fracciones</th>
                    <th className="px-4 py-3 text-center">Total Pedido</th>
                    <th className="px-4 py-3 text-center">Entregado</th>
                    <th className="px-4 py-3 text-center">Pendiente</th>
                    <th className="px-4 py-3 text-center">% Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tablaAgrupada.map((r, i) => {
                    const faltante = r.total - r.entregadas;
                    const p = pct(r.entregadas, r.total);
                    if (r.es_subtotal) {
                      return (
                        <tr key={`sub-${i}`} className="bg-slate-100 font-bold text-slate-700 border-t-2 border-slate-200">
                          <td className="px-4 py-2.5 text-center text-xs">{r.sector}</td>
                          <td className="px-4 py-2.5 text-xs uppercase tracking-wide">{r.coordinador}</td>
                          <td className="px-4 py-2.5 text-center text-xs">{r.paradas}</td>
                          <td className="px-4 py-2.5 text-center text-xs">{r.sm_activas}</td>
                          <td className="px-4 py-2.5 text-center text-xs">{r.fracciones}</td>
                          <td className="px-4 py-2.5 text-center text-xs">{r.total.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-emerald-700">{r.entregadas.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-amber-700">{faltante > 0 ? faltante.toLocaleString() : "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgePct(p)}`}>{p}%</span>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">{r.sector}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-800">{r.coordinador}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{r.paradas}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-700">{r.sm_activas}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{r.fracciones}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-700">{r.total.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-700">{r.entregadas.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-amber-600">
                          {faltante > 0 ? faltante.toLocaleString() : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgePct(p)}`}>{p}%</span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Gran total */}
                  <tr className="bg-blue-800 text-white font-black border-t-2 border-blue-600">
                    <td className="px-4 py-3 text-center text-xs" colSpan={2}>TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-center text-sm">{granTotal.paradas}</td>
                    <td className="px-4 py-3 text-center text-sm">{granTotal.sm_activas}</td>
                    <td className="px-4 py-3 text-center text-sm">{granTotal.fracciones}</td>
                    <td className="px-4 py-3 text-center text-sm">{granTotal.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-sm text-emerald-300">{granTotal.entregadas.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-sm text-amber-300">
                      {(granTotal.total - granTotal.entregadas) > 0
                        ? (granTotal.total - granTotal.entregadas).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-black text-white">{avance}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtrados.length > 0 && !cargando && (
          <p className="text-[11px] text-slate-400 text-right pr-1">
            {totalFilas.toLocaleString()} registros · {tablaAgrupada.filter((r) => !r.es_subtotal).length} coordinadores
          </p>
        )}
      </main>
    </div>
  );
}
