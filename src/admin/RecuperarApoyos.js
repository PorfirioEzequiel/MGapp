import React, { useEffect, useState, useMemo } from "react";
import { supabaseStorage as supabaseAdmin } from "../supabase/client";
import { useNavigate } from "react-router-dom";

const fmtFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function RecuperarApoyos() {
  const navigate = useNavigate();

  const [cargando,   setCargando]   = useState(true);
  const [huerfanos,  setHuerfanos]  = useState([]);
  const [busqueda,   setBusqueda]   = useState("");
  const [seleccion,  setSeleccion]  = useState(new Set());
  const [guardando,  setGuardando]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [insertados, setInsertados] = useState(0);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    setErrorMsg("");
    setSeleccion(new Set());
    try {
      const { data: ciudadanos, error: ce } = await supabaseAdmin
        .from("ciudadania")
        .select("id, nombre, a_paterno, a_materno, curp, seccion, ubt, created_at")
        .eq("puesto", "BENEFICIARIO")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (ce) throw ce;
      if (!ciudadanos?.length) { setHuerfanos([]); return; }

      const ids = ciudadanos.map((c) => c.id);

      const { data: entregas, error: ee } = await supabaseAdmin
        .from("apoyo_entregas")
        .select("beneficiario_id")
        .in("beneficiario_id", ids);
      if (ee) throw ee;

      const conApoyo = new Set((entregas ?? []).map((e) => e.beneficiario_id));
      setHuerfanos(ciudadanos.filter((c) => !conApoyo.has(c.id)));
    } catch (err) {
      setErrorMsg("Error al cargar: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return huerfanos;
    const q = busqueda.trim().toLowerCase();
    return huerfanos.filter((c) => {
      const nombre = `${c.nombre} ${c.a_paterno} ${c.a_materno}`.toLowerCase();
      return nombre.includes(q) || (c.curp ?? "").toLowerCase().includes(q);
    });
  }, [huerfanos, busqueda]);

  const toggleTodos = () => {
    if (seleccion.size === filtrados.length) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(filtrados.map((c) => c.id)));
    }
  };

  const toggleUno = (id) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const crearRegistros = async () => {
    if (seleccion.size === 0) return;
    setGuardando(true);
    setErrorMsg("");
    try {
      const inserts = [...seleccion].map((id) => ({
        beneficiario_id: id,
        status: "PENDIENTE",
      }));

      const { error } = await supabaseAdmin
        .from("apoyo_entregas")
        .insert(inserts);
      if (error) throw error;

      setInsertados((prev) => prev + seleccion.size);
      setHuerfanos((prev) => prev.filter((c) => !seleccion.has(c.id)));
      setSeleccion(new Set());
    } catch (err) {
      setErrorMsg("Error al insertar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const todosSeleccionados = filtrados.length > 0 && seleccion.size === filtrados.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-5">
        <button onClick={() => navigate(-1)} className="text-orange-200 text-sm mb-2 hover:text-white">
          ← Volver
        </button>
        <h1 className="text-white font-bold text-xl">Recuperar Apoyos</h1>
        <p className="text-orange-100 text-xs mt-0.5">
          Beneficiarios sin registro en apoyo_entregas
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {insertados > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold">
            {insertados} registro{insertados !== 1 ? "s" : ""} creado{insertados !== 1 ? "s" : ""} correctamente.
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        {/* Controles */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder="Buscar nombre o CURP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={cargar}
            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition"
          >
            Recargar
          </button>
          {seleccion.size > 0 && (
            <button
              onClick={crearRegistros}
              disabled={guardando}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {guardando ? "Creando..." : `Crear ${seleccion.size} registro${seleccion.size !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {cargando ? (
          <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            {busqueda ? "Sin resultados." : "No hay beneficiarios sin apoyo."}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Encabezado de tabla */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={toggleTodos}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex-1">
                Beneficiario
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide w-16 text-center hidden sm:block">
                Secc.
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide w-28 text-right hidden sm:block">
                Registro
              </span>
            </div>

            {/* Filas */}
            <div className="divide-y divide-slate-100">
              {filtrados.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.has(c.id)}
                    onChange={() => toggleUno(c.id)}
                    className="w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {c.nombre} {c.a_paterno} {c.a_materno}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {c.curp ?? "Sin CURP"} · ID {c.id}
                    </p>
                  </div>
                  <span className="text-sm text-slate-600 w-16 text-center hidden sm:block shrink-0">
                    {c.seccion ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400 w-28 text-right hidden sm:block shrink-0">
                    {fmtFecha(c.created_at)}
                  </span>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {filtrados.length} beneficiario{filtrados.length !== 1 ? "s" : ""} · {seleccion.size} seleccionado{seleccion.size !== 1 ? "s" : ""}
              </span>
              {seleccion.size > 0 && (
                <button
                  onClick={crearRegistros}
                  disabled={guardando}
                  className="px-4 py-2 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {guardando ? "Creando..." : `Crear ${seleccion.size} registro${seleccion.size !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
