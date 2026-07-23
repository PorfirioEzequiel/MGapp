import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../supabase/client';

const CUPO_POR_DIA = 80;

const JORNADAS = [
  { fecha: "2026-07-23", sector: 6, label: "Sector 6", dia: "Jueves 23 de julio", color: "blue" },
  { fecha: "2026-07-24", sector: 5, label: "Sector 5", dia: "Viernes 24 de julio", color: "violet" },
];

const COLOR = {
  blue:   { tab: "bg-blue-600 text-white",   badge: "bg-blue-100 text-blue-700",   bar: "bg-blue-500",   ring: "ring-blue-200" },
  violet: { tab: "bg-violet-600 text-white", badge: "bg-violet-100 text-violet-700", bar: "bg-violet-500", ring: "ring-violet-200" },
};

const STATUS_CFG = {
  AGENDADA:   { label: "Agendada",   cls: "bg-blue-100 text-blue-700" },
  REAGENDADA: { label: "Reagendada", cls: "bg-amber-100 text-amber-700" },
  CHECKIN:    { label: "Check-in",   cls: "bg-emerald-100 text-emerald-700" },
  ASISTIDA:   { label: "Asistida",   cls: "bg-emerald-100 text-emerald-700" },
  CANCELADA:  { label: "Cancelada",  cls: "bg-red-100 text-red-700" },
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

const ReporteCertificados = () => {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jornadaActiva, setJornadaActiva] = useState(JORNADAS[0].fecha);
  const [busqueda, setBusqueda] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => { fetchRegistros(); }, []);

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

  const totalRegistros = registros.length;
  const totalMenores = registros.reduce((s, r) => s + (r.numero_menores || 0), 0);
  const totalFamilias = registros.length;

  const metricasPorFecha = useMemo(() => {
    const map = {};
    JORNADAS.forEach(j => {
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
  }, [registros]);

  const jornada = JORNADAS.find(j => j.fecha === jornadaActiva);
  const colores = COLOR[jornada?.color ?? "blue"];
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
          <button
            onClick={fetchRegistros}
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

      <div className="max-w-5xl mx-auto px-4 space-y-6 pb-10">
        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total registros" value={totalRegistros} sub={`de ${JORNADAS.length * CUPO_POR_DIA} cupos totales`} />
          <Stat label="Familias" value={totalFamilias} />
          <Stat label="Menores beneficiarios" value={totalMenores} />
        </div>

        {/* Resumen por jornada */}
        <div className="grid gap-3 sm:grid-cols-2">
          {JORNADAS.map(j => {
            const m = metricasPorFecha[j.fecha] ?? { total: 0, menores: 0, pct: 0 };
            const c = COLOR[j.color ?? "blue"];
            const pctColor = m.pct >= 90 ? "bg-red-500" : m.pct >= 60 ? "bg-amber-500" : c.bar;
            return (
              <div key={j.fecha} className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${jornadaActiva === j.fecha ? `border-current ${j.color === "violet" ? "text-violet-600" : "text-blue-600"}` : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                onClick={() => { setJornadaActiva(j.fecha); setBusqueda(""); }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{j.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{j.dia}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${j.color === "violet" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
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
            <div className={`px-4 py-3 flex items-center justify-between ${jornada.color === "violet" ? "bg-violet-600" : "bg-blue-600"}`}>
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
