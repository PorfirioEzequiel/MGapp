import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../supabase/client';

const CUPO_POR_DIA = 100;

const COLOR_POOL = ["blue","violet","emerald","orange","rose","cyan","indigo","teal","amber","sky","purple","pink"];

const COLOR = {
  blue:    { tab: "bg-blue-600 text-white",    badge: "bg-blue-100 text-blue-700",      bar: "bg-blue-500",    text: "text-blue-600" },
  violet:  { tab: "bg-violet-600 text-white",  badge: "bg-violet-100 text-violet-700",  bar: "bg-violet-500",  text: "text-violet-600" },
  emerald: { tab: "bg-emerald-600 text-white", badge: "bg-emerald-100 text-emerald-700",bar: "bg-emerald-500", text: "text-emerald-600" },
  orange:  { tab: "bg-orange-600 text-white",  badge: "bg-orange-100 text-orange-700",  bar: "bg-orange-500",  text: "text-orange-600" },
  rose:    { tab: "bg-rose-600 text-white",    badge: "bg-rose-100 text-rose-700",      bar: "bg-rose-500",    text: "text-rose-600" },
  cyan:    { tab: "bg-cyan-600 text-white",    badge: "bg-cyan-100 text-cyan-700",      bar: "bg-cyan-500",    text: "text-cyan-600" },
  indigo:  { tab: "bg-indigo-600 text-white",  badge: "bg-indigo-100 text-indigo-700",  bar: "bg-indigo-500",  text: "text-indigo-600" },
  teal:    { tab: "bg-teal-600 text-white",    badge: "bg-teal-100 text-teal-700",      bar: "bg-teal-500",    text: "text-teal-600" },
  amber:   { tab: "bg-amber-600 text-white",   badge: "bg-amber-100 text-amber-700",    bar: "bg-amber-500",   text: "text-amber-600" },
  sky:     { tab: "bg-sky-600 text-white",     badge: "bg-sky-100 text-sky-700",        bar: "bg-sky-500",     text: "text-sky-600" },
  purple:  { tab: "bg-purple-600 text-white",  badge: "bg-purple-100 text-purple-700",  bar: "bg-purple-500",  text: "text-purple-600" },
  pink:    { tab: "bg-pink-600 text-white",    badge: "bg-pink-100 text-pink-700",      bar: "bg-pink-500",    text: "text-pink-600" },
};

const STATUS_CFG = {
  AGENDADA:   { label: "Agendada",   cls: "bg-blue-100 text-blue-700" },
  REAGENDADA: { label: "Reagendada", cls: "bg-amber-100 text-amber-700" },
  CHECKIN:    { label: "Check-in",   cls: "bg-emerald-100 text-emerald-700" },
  ASISTIDA:   { label: "Asistida",   cls: "bg-emerald-100 text-emerald-700" },
  CANCELADA:  { label: "Cancelada",  cls: "bg-red-100 text-red-700" },
};

const formatDia = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  const date = new Date(+y, +m - 1, +d);
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("es-MX", { month: "long" });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} de ${month}`;
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? { label: status ?? "—", cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const Stat = ({ label, value, sub }) => (
  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const Campo = ({ label, required, children }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const InputField = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`}
  />
);

const ReporteCertificados = () => {
  const [jornadas, setJornadas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jornadaActiva, setJornadaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  // Modal nueva jornada
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formJornada, setFormJornada] = useState({ fecha: "", sector: "", horaInicio: "09:30", ubicacionUrl: "" });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  useEffect(() => { fetchJornadas(); fetchRegistros(); }, []);

  const fetchJornadas = async () => {
    const { data } = await supabase
      .from("jornadas_certificados")
      .select("*")
      .eq("activa", true)
      .order("fecha", { ascending: true });
    if (data) {
      const mapped = data.map((j, i) => ({
        fecha: j.fecha,
        sector: j.sector,
        label: j.sector_label,
        dia: formatDia(j.fecha),
        color: j.color || COLOR_POOL[i % COLOR_POOL.length],
        horaInicio: j.hora_inicio,
        ubicacionMapsUrl: j.ubicacion_maps_url,
      }));
      setJornadas(mapped);
      setJornadaActiva(prev => prev ?? (mapped[0]?.fecha ?? null));
    }
  };

  const fetchRegistros = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("beneficiarios_certificados")
      .select("id, folio, tutor_nombre, tutor_a_paterno, tutor_a_materno, tutor_curp, fecha_cita, hora_cita, numero_menores, status, telefono, col_loc, c_p, created_at")
      .order("fecha_cita", { ascending: true })
      .order("hora_cita", { ascending: true });
    setRegistros(data ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const guardarJornada = async () => {
    if (!formJornada.fecha || !formJornada.sector) {
      setErrorForm("La fecha y el sector son obligatorios.");
      return;
    }
    setGuardando(true);
    setErrorForm("");
    const nextColor = COLOR_POOL[jornadas.length % COLOR_POOL.length];
    const { error } = await supabase.from("jornadas_certificados").insert([{
      fecha: formJornada.fecha,
      sector: parseInt(formJornada.sector, 10),
      sector_label: `Sector ${formJornada.sector}`,
      hora_inicio: formJornada.horaInicio || "09:30",
      ubicacion_maps_url: formJornada.ubicacionUrl.trim() || null,
      color: nextColor,
      activa: true,
    }]);
    if (error) {
      setErrorForm(error.message.includes("unique") ? "Ya existe una jornada para esa fecha." : "Error al guardar: " + error.message);
      setGuardando(false);
      return;
    }
    setMostrarForm(false);
    setFormJornada({ fecha: "", sector: "", horaInicio: "09:30", ubicacionUrl: "" });
    await fetchJornadas();
    setGuardando(false);
  };

  const totalRegistros = registros.length;
  const totalMenores = registros.reduce((s, r) => s + (r.numero_menores || 0), 0);
  const totalFamilias = registros.length;

  const metricasPorFecha = useMemo(() => {
    const map = {};
    jornadas.forEach(j => {
      const rows = registros.filter(r => r.fecha_cita === j.fecha);
      const statusCount = {};
      rows.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });
      map[j.fecha] = {
        total: rows.length,
        menores: rows.reduce((s, r) => s + (r.numero_menores || 0), 0),
        statusCount,
        pct: Math.min(100, Math.round((rows.length / CUPO_POR_DIA) * 100)),
      };
    });
    return map;
  }, [registros, jornadas]);

  const jornada = jornadas.find(j => j.fecha === jornadaActiva);
  const metricas = metricasPorFecha[jornadaActiva] ?? { total: 0, menores: 0, statusCount: {}, pct: 0 };

  const registrosFiltrados = useMemo(() => {
    const base = registros.filter(r => r.fecha_cita === jornadaActiva);
    if (!busqueda.trim()) return base;
    const q = busqueda.toLowerCase();
    return base.filter(r =>
      (r.folio || "").toLowerCase().includes(q) ||
      (r.tutor_nombre || "").toLowerCase().includes(q) ||
      (r.tutor_a_paterno || "").toLowerCase().includes(q) ||
      (r.tutor_curp || "").toLowerCase().includes(q) ||
      (r.telefono || "").includes(q)
    );
  }, [registros, jornadaActiva, busqueda]);

  const porHora = useMemo(() => {
    const base = registros.filter(r => r.fecha_cita === jornadaActiva);
    const map = {};
    base.forEach(r => { const h = r.hora_cita || "—"; map[h] = (map[h] || 0) + 1; });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [registros, jornadaActiva]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 mb-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">Certificados Médicos</h1>
            <p className="text-blue-200 text-xs mt-0.5">Reporte de registros por sector</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMostrarForm(true); setErrorForm(""); }}
              className="flex items-center gap-1.5 bg-white text-blue-700 text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nueva Jornada
            </button>
            <button
              onClick={() => { fetchJornadas(); fetchRegistros(); }}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Nueva Jornada */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Cabecera modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base">Nueva Jornada</h2>
                <p className="text-blue-200 text-xs mt-0.5">Agrega una nueva fecha de certificados médicos</p>
              </div>
              <button onClick={() => setMostrarForm(false)} className="text-white/70 hover:text-white transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario */}
            <div className="px-5 py-5 space-y-4">
              <Campo label="Fecha" required>
                <InputField
                  type="date"
                  value={formJornada.fecha}
                  onChange={e => setFormJornada(f => ({ ...f, fecha: e.target.value }))}
                />
              </Campo>

              <Campo label="Número de sector" required>
                <InputField
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Ej. 5"
                  value={formJornada.sector}
                  onChange={e => setFormJornada(f => ({ ...f, sector: e.target.value }))}
                />
              </Campo>

              <Campo label="Horario de inicio">
                <InputField
                  type="time"
                  value={formJornada.horaInicio}
                  onChange={e => setFormJornada(f => ({ ...f, horaInicio: e.target.value }))}
                />
              </Campo>

              <Campo label="URL de ubicación (Google Maps)">
                <InputField
                  type="url"
                  placeholder="https://maps.app.goo.gl/..."
                  value={formJornada.ubicacionUrl}
                  onChange={e => setFormJornada(f => ({ ...f, ubicacionUrl: e.target.value }))}
                />
              </Campo>

              {errorForm && (
                <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  {errorForm}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={guardarJornada}
                  disabled={guardando}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar jornada"}
                </button>
                <button
                  onClick={() => { setMostrarForm(false); setErrorForm(""); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 space-y-6 pb-10">
        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total registros" value={totalRegistros} sub={`de ${jornadas.length * CUPO_POR_DIA} cupos totales`} />
          <Stat label="Familias" value={totalFamilias} />
          <Stat label="Menores beneficiarios" value={totalMenores} />
        </div>

        {/* Resumen por jornada */}
        <div className="grid gap-3 sm:grid-cols-2">
          {jornadas.map(j => {
            const m = metricasPorFecha[j.fecha] ?? { total: 0, menores: 0, pct: 0 };
            const c = COLOR[j.color ?? "blue"];
            const pctColor = m.pct >= 90 ? "bg-red-500" : m.pct >= 60 ? "bg-amber-500" : c.bar;
            return (
              <div
                key={j.fecha}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  jornadaActiva === j.fecha
                    ? `border-current ${COLOR[j.color ?? "blue"].text}`
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
                onClick={() => { setJornadaActiva(j.fecha); setBusqueda(""); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{j.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{j.dia}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${COLOR[j.color ?? "blue"].badge}`}>
                    {m.pct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${m.pct}%` }} />
                </div>
                <div className="flex gap-4 text-xs">
                  <span><span className="font-bold text-slate-900">{m.total}</span> <span className="text-slate-400">/ {CUPO_POR_DIA} registros</span></span>
                  <span><span className="font-bold text-slate-900">{m.menores}</span> <span className="text-slate-400">menores</span></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalle de jornada activa */}
        {jornada && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Cabecera */}
            <div className={`px-4 py-3 flex items-center justify-between ${COLOR[jornada.color ?? "blue"].tab}`}>
              <div>
                <p className="text-white font-bold text-sm">{jornada.label} — {jornada.dia}</p>
                <p className="text-white/70 text-xs mt-0.5">
                  {metricas.total} registros · {metricas.menores} menores · Cupo {CUPO_POR_DIA - metricas.total} disponible
                </p>
              </div>
              <span className="text-white/80 text-xs">
                {lastRefresh ? `Act. ${lastRefresh.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            </div>

            {/* Status breakdown */}
            {Object.keys(metricas.statusCount).length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                {Object.entries(metricas.statusCount).map(([st, cnt]) => {
                  const cfg = STATUS_CFG[st] ?? { label: st, cls: "bg-slate-100 text-slate-600" };
                  return (
                    <span key={st} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.cls}`}>
                      {cfg.label} <span className="opacity-70">·</span> {cnt}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Distribución por hora */}
            {porHora.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Distribución por horario</p>
                <div className="flex flex-wrap gap-1.5">
                  {porHora.map(([hora, cnt]) => (
                    <span key={hora} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs">
                      <span className="font-bold text-slate-700">{hora}</span>
                      <span className="text-slate-400">·</span>
                      <span className={`font-bold ${cnt >= 3 ? "text-red-600" : cnt >= 2 ? "text-amber-600" : "text-emerald-600"}`}>{cnt}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Buscador */}
            <div className="px-4 py-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Buscar por folio, nombre, CURP o teléfono…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tabla */}
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span className="text-sm text-slate-500">Cargando registros…</span>
              </div>
            ) : registrosFiltrados.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-400 font-medium">
                  {busqueda ? "Sin resultados para esa búsqueda." : "Sin registros para esta jornada."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">#</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Folio</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tutor</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Hora</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Menores</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrosFiltrados.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{r.folio}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-800 text-xs leading-snug">
                            {r.tutor_nombre} {r.tutor_a_paterno} {r.tutor_a_materno}
                          </p>
                          <p className="text-slate-400 text-[10px] mt-0.5 font-mono">{r.tutor_curp}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{r.hora_cita ?? "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${r.numero_menores > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                            {r.numero_menores || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.telefono ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {registrosFiltrados.length !== metricas.total && (
                  <p className="text-center text-xs text-slate-400 py-3">
                    Mostrando {registrosFiltrados.length} de {metricas.total} registros
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteCertificados;
