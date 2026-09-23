import React, { useEffect, useState } from "react";
import supabase from "../supabase/client";
import { useNavigate } from "react-router-dom";

const badgePuesto = (puesto) => {
  const m = {
    SM:           "bg-blue-100 text-blue-700",
    SP:           "bg-violet-100 text-violet-700",
    COORDINADOR:  "bg-emerald-100 text-emerald-700",
    BENEFICIARIO: "bg-amber-100 text-amber-700",
  };
  return m[puesto] ?? "bg-slate-100 text-slate-600";
};

export default function SolicitudesAdmin() {
  const navigate = useNavigate();
  const [tipo,        setTipo]        = useState("ALTA");
  const [solicitudes, setSolicitudes] = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [procesando,  setProcesando]  = useState(false);

  useEffect(() => { fetchSolicitudes(); }, [tipo]);

  const fetchSolicitudes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("ciudadania")
        .select("*")
        .eq("status", tipo === "ALTA" ? "SOLICITUD DE ALTA" : "SOLICITAR BAJA")
        .order("ingreso_estructura", { ascending: false });
      if (error) throw error;
      setSolicitudes(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id, decision) => {
    const nuevoStatus =
      decision === "APROBAR"
        ? tipo === "ALTA" ? "ACTIVO" : "ELIMINADO"
        : "RECHAZADA";
    setProcesando(true);
    const { error } = await supabase
      .from("ciudadania")
      .update({ status: nuevoStatus })
      .eq("id", id);
    setProcesando(false);
    if (!error) {
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
      setSelected(null);
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
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
            <h1 className="text-xl font-black tracking-tight">Gestión de Solicitudes</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "ALTA", label: "Solicitudes de Alta",  active: "bg-emerald-600 text-white shadow-sm", inactive: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" },
            { key: "BAJA", label: "Solicitudes de Baja",  active: "bg-red-600 text-white shadow-sm",     inactive: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" },
          ].map(({ key, label, active, inactive }) => (
            <button
              key={key}
              onClick={() => setTipo(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tipo === key ? active : inactive}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Estado */}
        {loading && (
          <p className="text-center text-slate-400 text-sm py-8">Cargando...</p>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {/* Lista */}
        {!loading && !error && solicitudes.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No hay solicitudes de {tipo === "ALTA" ? "alta" : "baja"} pendientes.
          </div>
        )}

        {!loading && solicitudes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Encabezado */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center w-20">Puesto</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center w-14 hidden sm:block">Secc.</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center w-14 hidden sm:block">Fracc.</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center w-12"></span>
            </div>

            <div className="divide-y divide-slate-100">
              {solicitudes.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-3 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {s.nombre} {s.a_paterno} {s.a_materno}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{s.poligono ?? "—"}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-20 text-center ${badgePuesto(s.puesto)}`}>
                    {s.puesto}
                  </span>
                  <span className="text-sm text-slate-600 w-14 text-center hidden sm:block">{s.seccion ?? "—"}</span>
                  <span className="text-sm text-slate-600 w-14 text-center hidden sm:block">{s.ubt ?? "—"}</span>
                  <button
                    onClick={() => setSelected(s)}
                    className="w-12 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Ver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">
            {/* Cabecera modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-black text-slate-800">Datos de la Solicitud</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Fotos */}
              <div className="flex gap-3 flex-wrap">
                {[
                  { src: selected.url_foto_perfil, label: "Perfil" },
                  { src: selected.url_foto_ine1,   label: "INE Frente" },
                  { src: selected.url_foto_ine2,   label: "INE Reverso" },
                ].map(({ src, label }) => (
                  src ? (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <img
                        src={src}
                        alt={label}
                        className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
                    </div>
                  ) : null
                ))}
              </div>

              {/* Datos */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                {[
                  { label: "Nombre",       value: `${selected.nombre ?? ""} ${selected.a_paterno ?? ""} ${selected.a_materno ?? ""}`.trim() },
                  { label: "CURP",         value: selected.curp },
                  { label: "Teléfono",     value: selected.telefono_1 },
                  { label: "Dirección",    value: [selected.calle, selected.n_ext_mz, selected.n_int_lt, selected.n_casa, selected.c_p, selected.col_loc].filter(Boolean).join(" ") || null },
                  { label: "Puesto",       value: selected.puesto },
                  { label: "Sector",       value: selected.poligono },
                  { label: "Sección",      value: selected.seccion },
                  { label: "Fracción",     value: selected.ubt },
                  { label: "Observaciones",value: selected.observaciones },
                  { label: "Motivo baja",  value: selected.motivo_baja },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-xs font-bold text-slate-500 w-24 shrink-0">{label}</span>
                    <span className="text-xs text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => handleDecision(selected.id, "APROBAR")}
                disabled={procesando}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
              >
                Aprobar
              </button>
              <button
                onClick={() => handleDecision(selected.id, "RECHAZAR")}
                disabled={procesando}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
              >
                Rechazar
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={procesando}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
