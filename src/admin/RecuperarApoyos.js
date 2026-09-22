import React, { useEffect, useState, useMemo } from "react";
import supabase, { supabaseStorage as supabaseAdmin } from "../supabase/client";
import { useNavigate } from "react-router-dom";

const fmtFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const periodoActual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function RecuperarApoyos() {
  const navigate = useNavigate();

  const [cargando,   setCargando]   = useState(true);
  const [huerfanos,  setHuerfanos]  = useState([]);
  const [programas,  setProgramas]  = useState([]);
  const [busqueda,   setBusqueda]   = useState("");
  const [formAbierto, setFormAbierto] = useState(null); // id del ciudadano con form abierto
  const [progSel,    setProgSel]    = useState("");
  const [cantSel,    setCantSel]    = useState("1");
  const [guardando,  setGuardando]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [ok,         setOk]         = useState([]);

  useEffect(() => {
    cargar();
    supabaseAdmin
      .from("programas_sociales")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setProgramas(data ?? []));
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      // 1. Todos los beneficiarios
      const { data: ciudadanos, error: ce } = await supabaseAdmin
        .from("ciudadania")
        .select("id, nombre, a_paterno, a_materno, curp, seccion, ubt, created_at")
        .eq("puesto", "BENEFICIARIO")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (ce) throw ce;

      if (!ciudadanos?.length) { setHuerfanos([]); return; }

      const ids = ciudadanos.map((c) => c.id);

      // 2. IDs que YA tienen al menos un apoyo
      const { data: entregas, error: ee } = await supabaseAdmin
        .from("apoyo_entregas")
        .select("beneficiario_id")
        .in("beneficiario_id", ids);
      if (ee) throw ee;

      const conApoyo = new Set((entregas ?? []).map((e) => e.beneficiario_id));

      // 3. Diferencia: los que NO tienen ningún registro
      setHuerfanos(ciudadanos.filter((c) => !conApoyo.has(c.id)));
    } catch (err) {
      setErrorMsg("Error al cargar datos: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const abrirForm = (id) => {
    setFormAbierto(id);
    setProgSel(programas[0]?.id ?? "");
    setCantSel("1");
    setErrorMsg("");
  };

  const cerrarForm = () => {
    setFormAbierto(null);
    setProgSel("");
    setCantSel("1");
    setErrorMsg("");
  };

  const registrar = async (ciudadano) => {
    if (!progSel) { setErrorMsg("Selecciona un programa."); return; }
    const cant = parseInt(cantSel, 10);
    if (!cant || cant < 1) { setErrorMsg("La cantidad debe ser mayor a 0."); return; }

    setGuardando(true);
    setErrorMsg("");
    try {
      const { error } = await supabaseAdmin
        .from("apoyo_entregas")
        .insert([{
          beneficiario_id: ciudadano.id,
          programa_id:     progSel,
          cantidad:        cant,
          status:          "PENDIENTE",
          periodo:         periodoActual(),
        }]);
      if (error) throw error;

      setOk((prev) => [...prev, ciudadano.id]);
      setHuerfanos((prev) => prev.filter((c) => c.id !== ciudadano.id));
      cerrarForm();
    } catch (err) {
      setErrorMsg("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-5">
        <button
          onClick={() => navigate(-1)}
          className="text-orange-200 text-sm mb-2 hover:text-white"
        >
          ← Volver
        </button>
        <h1 className="text-white font-bold text-xl">Recuperar Apoyos</h1>
        <p className="text-orange-100 text-xs mt-0.5">
          Beneficiarios registrados sin pedido de apoyo asignado
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Buscador + contador */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre o CURP..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={cargar}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition"
          >
            Recargar
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        {cargando ? (
          <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            {busqueda ? "No hay resultados para esa búsqueda." : "No hay beneficiarios sin apoyo registrado."}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {filtrados.length} beneficiario{filtrados.length !== 1 ? "s" : ""} sin apoyo
            </p>
            <div className="space-y-3">
              {filtrados.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Fila principal */}
                  <div className="flex items-center justify-between p-4 gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">
                        {c.nombre} {c.a_paterno} {c.a_materno}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        CURP: {c.curp ?? "—"} · Secc. {c.seccion ?? "—"} · {fmtFecha(c.created_at)}
                      </p>
                    </div>
                    {formAbierto === c.id ? (
                      <button
                        onClick={cerrarForm}
                        className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => abrirForm(c.id)}
                        className="shrink-0 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition"
                      >
                        Registrar apoyo
                      </button>
                    )}
                  </div>

                  {/* Formulario inline */}
                  {formAbierto === c.id && (
                    <div className="border-t border-slate-100 bg-orange-50 px-4 py-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Programa de apoyo
                          </label>
                          <select
                            value={progSel}
                            onChange={(e) => setProgSel(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                          >
                            <option value="">— Seleccionar —</option>
                            {programas.map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={cantSel}
                            onChange={(e) => setCantSel(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => registrar(c)}
                            disabled={guardando}
                            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                          >
                            {guardando ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      </div>
                      {errorMsg && (
                        <p className="text-red-600 text-xs mt-2">{errorMsg}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
