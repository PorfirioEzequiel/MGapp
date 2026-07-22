import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../supabase/client';

const PUESTOS = ['SM', 'SECCIONAL', 'SP', 'ENLACE'];

const STATUS_BADGE = {
  COMPROBADO: 'bg-emerald-100 text-emerald-700',
  FUERA_DE_TIEMPO: 'bg-amber-100 text-amber-700',
};

const inputCls =
  'border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
    {children}
  </div>
);

const Actividades = () => {
  const [tab, setTab] = useState('lista');
  const [actividades, setActividades] = useState([]);
  const [evidencias, setEvidencias] = useState([]);
  const [loadingActs, setLoadingActs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState('');

  // Form para nueva actividad
  const [form, setForm] = useState({
    nombre: '',
    indicacion: '',
    puesto: 'SM',
    fecha_limite: '',
  });

  useEffect(() => {
    fetchActividades();
  }, []);

  useEffect(() => {
    if (tab === 'reportes') fetchEvidencias();
  }, [tab]);

  const fetchActividades = async () => {
    setLoadingActs(true);
    const { data } = await supabase.from('actividades').select('*').order('created_at', { ascending: false });
    setActividades(data ?? []);
    setLoadingActs(false);
  };

  const fetchEvidencias = async () => {
    const { data } = await supabase
      .from('evidencias_actividades')
      .select('*')
      .order('fecha_subida', { ascending: false });
    setEvidencias(data ?? []);
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      indicacion: form.indicacion.trim() || null,
      puesto: form.puesto,
      fecha_limite: form.fecha_limite || null,
    };
    const { error } = await supabase.from('actividades').insert(payload);
    setSaving(false);
    if (error) { alert('Error: ' + error.message); return; }
    setForm({ nombre: '', indicacion: '', puesto: 'SM', fecha_limite: '' });
    fetchActividades();
    setTab('lista');
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta actividad? También se eliminarán las evidencias registradas.')) return;
    await supabase.from('evidencias_actividades').delete().eq('actividad_id', id);
    await supabase.from('actividades').delete().eq('id', id);
    fetchActividades();
  };

  // Evidencias filtradas por actividad seleccionada
  const evidenciasFiltradas = useMemo(() => {
    if (!actividadSeleccionada) return evidencias;
    return evidencias.filter(e => e.actividad_id === actividadSeleccionada);
  }, [evidencias, actividadSeleccionada]);

  // Agrupación por sector para el reporte
  const resumenSectores = useMemo(() => {
    const map = {};
    evidenciasFiltradas.forEach(e => {
      const key = e.poligono || '?';
      if (!map[key]) map[key] = { sector: key, total: 0, COMPROBADO: 0, FUERA_DE_TIEMPO: 0 };
      map[key].total++;
      if (e.status === 'COMPROBADO') map[key].COMPROBADO++;
      if (e.status === 'FUERA_DE_TIEMPO') map[key].FUERA_DE_TIEMPO++;
    });
    return Object.values(map).sort((a, b) => String(a.sector).localeCompare(String(b.sector)));
  }, [evidenciasFiltradas]);

  const TABS = [
    { key: 'lista', label: 'Actividades' },
    { key: 'nueva', label: '+ Nueva' },
    { key: 'reportes', label: 'Reportes' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5">
        <h1 className="text-white font-bold text-xl">Actividades</h1>
        <p className="text-blue-200 text-xs mt-0.5">Gestión y seguimiento de actividades de la estructura</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 text-xs font-bold py-3.5 transition-colors ${tab === t.key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-400 hover:text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {/* ── LISTA ── */}
        {tab === 'lista' && (
          <div className="space-y-3">
            {loadingActs && (
              <div className="text-center py-12">
                <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Cargando actividades…</p>
              </div>
            )}
            {!loadingActs && actividades.length === 0 && (
              <div className="text-center py-20 text-slate-300">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm font-medium text-slate-400">No hay actividades creadas aún</p>
                <button onClick={() => setTab('nueva')}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                  Crear primera actividad
                </button>
              </div>
            )}
            {actividades.map(act => (
              <div key={act.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{act.puesto}</span>
                      {act.fecha_limite && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          new Date() > new Date(act.fecha_limite)
                            ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                          {new Date() > new Date(act.fecha_limite) ? '⚠ Vencida' : '⏱ Con límite'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">{act.nombre}</h3>
                    {act.indicacion && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{act.indicacion}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      {act.fecha_limite && (
                        <p className="text-[10px] text-slate-400">
                          Límite: {new Date(act.fecha_limite).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-300">
                        Creada: {new Date(act.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleEliminar(act.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── NUEVA ACTIVIDAD ── */}
        {tab === 'nueva' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Nueva Actividad</h2>
            <form onSubmit={handleCrear} className="space-y-4">
              <Field label="Nombre de la actividad">
                <input
                  className={inputCls}
                  placeholder="Ej. Entrega de periódicos"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </Field>

              <Field label="Indicación">
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={3}
                  placeholder="Instrucciones para realizar la actividad…"
                  value={form.indicacion}
                  onChange={e => setForm(f => ({ ...f, indicacion: e.target.value }))}
                />
              </Field>

              <Field label="Puesto que la realiza">
                <select
                  className={inputCls}
                  value={form.puesto}
                  onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))}
                >
                  {PUESTOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="Fecha límite (opcional)">
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.fecha_limite}
                  onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
                />
                <p className="text-[10px] text-slate-400">
                  Si se establece fecha límite, las evidencias entregadas después tendrán estatus "Fuera de tiempo".
                </p>
              </Field>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
                  {saving ? 'Guardando…' : 'Crear Actividad'}
                </button>
                <button type="button" onClick={() => setTab('lista')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── REPORTES ── */}
        {tab === 'reportes' && (
          <div className="space-y-4">
            {/* Selector de actividad */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <Field label="Filtrar por actividad">
                <select
                  className={inputCls}
                  value={actividadSeleccionada}
                  onChange={e => { setActividadSeleccionada(e.target.value); fetchEvidencias(); }}
                >
                  <option value="">Todas las actividades</option>
                  {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.puesto}</option>)}
                </select>
              </Field>
            </div>

            {/* Resumen por sector */}
            {resumenSectores.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">Resumen por Sector</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Sector', 'Total Evidencias', 'Comprobadas', 'Fuera de tiempo'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumenSectores.map(s => (
                        <tr key={s.sector} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">{s.sector}</td>
                          <td className="px-4 py-3 text-xs tabular-nums text-slate-500">{s.total}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{s.COMPROBADO}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{s.FUERA_DE_TIEMPO}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla individual de evidencias */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Evidencias individuales</p>
                <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5 font-semibold">{evidenciasFiltradas.length}</span>
              </div>
              {evidenciasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-slate-300">
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-sm text-slate-400">Sin evidencias registradas</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {evidenciasFiltradas.map(ev => {
                    const act = actividades.find(a => a.id === ev.actividad_id);
                    return (
                      <div key={ev.id} className="p-4 flex items-start gap-4 hover:bg-slate-50/60 transition-colors">
                        {ev.url_evidencia && (
                          <img src={ev.url_evidencia} alt="evidencia" className="w-16 h-16 object-cover rounded-xl border border-slate-100 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[ev.status] || 'bg-slate-100 text-slate-500'}`}>
                              {ev.status === 'COMPROBADO' ? '✓ Comprobado' : '⏰ Fuera de tiempo'}
                            </span>
                            {act && <span className="text-[10px] text-slate-400 truncate">{act.nombre}</span>}
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{ev.nombre_sm}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400">Sector {ev.poligono}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400">Secc. {ev.seccion}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400">Fracc. {ev.ubt}</span>
                          </div>
                          <p className="text-[10px] text-slate-300 mt-0.5">
                            {new Date(ev.fecha_subida).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Actividades;
