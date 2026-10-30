import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';

const COLORES = [
  { label: 'Azul',    value: '#3B82F6' },
  { label: 'Rojo',    value: '#EF4444' },
  { label: 'Verde',   value: '#10B981' },
  { label: 'Naranja', value: '#F97316' },
  { label: 'Morado',  value: '#8B5CF6' },
  { label: 'Rosa',    value: '#EC4899' },
  { label: 'Cyan',    value: '#06B6D4' },
  { label: 'Ámbar',   value: '#F59E0B' },
];

const Brigadeo = () => {
  const navigate = useNavigate();

  let user = {};
  try { user = JSON.parse(sessionStorage.getItem('user') || '{}'); } catch (_) {}
  const isAdmin = ['administrador', 'master'].includes(String(user?.puesto ?? '').toLowerCase());
  const userSector = user?.poligono ? Number(user.poligono) : null;

  const [tab, setTab]               = useState('lista');
  const [brigadas, setBrigadas]     = useState([]);
  const [secciones, setSecciones]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [copiadoSlug, setCopiadoSlug] = useState(null);
  const [editando, setEditando]     = useState(null);

  // form
  const [nombre, setNombre]         = useState('');
  const [sector, setSector]         = useState(userSector ?? 1);
  const [secsSel, setSecsSel]       = useState([]);
  const [color, setColor]           = useState(COLORES[0].value);

  const fetchBrigadas = useCallback(async () => {
    let q = supabase.from('brigadas').select('*').order('sector').order('created_at');
    if (!isAdmin && userSector) q = q.eq('sector', userSector);
    const { data } = await q;
    setBrigadas(data ?? []);
    setLoading(false);
  }, [isAdmin, userSector]);

  const fetchSecciones = useCallback(async (sec) => {
    const { data } = await supabase
      .from('secciones')
      .select('seccion')
      .eq('sector', sec)
      .order('seccion');
    setSecciones((data ?? []).map(s => Number(s.seccion)));
  }, []);

  useEffect(() => { fetchBrigadas(); }, [fetchBrigadas]);

  useEffect(() => {
    if (tab === 'nueva' || editando) fetchSecciones(sector);
  }, [tab, sector, editando, fetchSecciones]);

  const resetForm = () => {
    setNombre(''); setSecsSel([]); setColor(COLORES[0].value);
    setSector(userSector ?? 1); setEditando(null);
  };

  const openNueva = () => { resetForm(); setTab('nueva'); };

  const openEditar = (b) => {
    setEditando(b.id);
    setNombre(b.nombre);
    setSector(b.sector);
    setSecsSel(b.secciones ?? []);
    setColor(b.color ?? COLORES[0].value);
    setTab('nueva');
  };

  const generateSlug = async (sec) => {
    const { count } = await supabase
      .from('brigadas')
      .select('id', { count: 'exact', head: true })
      .eq('sector', sec);
    return `equipo_s${sec}_${(count ?? 0) + 1}`;
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (secsSel.length === 0) { alert('Selecciona al menos una sección.'); return; }
    setSaving(true);

    if (editando) {
      const { error } = await supabase
        .from('brigadas')
        .update({ nombre: nombre.trim(), sector, secciones: secsSel, color })
        .eq('id', editando);
      setSaving(false);
      if (error) { alert('Error: ' + error.message); return; }
    } else {
      const slug = await generateSlug(sector);
      const { error } = await supabase.from('brigadas').insert({
        nombre: nombre.trim(),
        slug,
        sector,
        secciones: secsSel,
        color,
        created_by: user?.usuario ?? null,
      });
      setSaving(false);
      if (error) { alert('Error: ' + error.message); return; }
    }

    resetForm();
    setTab('lista');
    fetchBrigadas();
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta brigada?')) return;
    await supabase.from('brigadas').delete().eq('id', id);
    fetchBrigadas();
  };

  const handleCopiarLink = (slug) => {
    const url = `${window.location.origin}/brigada/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiadoSlug(slug);
    setTimeout(() => setCopiadoSlug(null), 2500);
  };

  const toggleSec = (sec) =>
    setSecsSel(prev =>
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec].sort((a, b) => a - b)
    );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const brigadasPorSector = brigadas.reduce((acc, b) => {
    const k = b.sector;
    if (!acc[k]) acc[k] = [];
    acc[k].push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5">
        <button onClick={() => navigate(-1)} className="text-blue-200 text-xs mb-2 hover:text-white">
          ← Volver
        </button>
        <h1 className="text-white font-bold text-xl">Rutas de Brigadeo</h1>
        <p className="text-blue-200 text-sm mt-0.5">Equipos de recorrido territorial</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-slate-100 sticky top-0 z-10">
        <button
          onClick={() => { resetForm(); setTab('lista'); }}
          className={`px-5 py-3 text-sm font-semibold transition-colors ${tab === 'lista' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Brigadas ({brigadas.length})
        </button>
        <button
          onClick={openNueva}
          className={`px-5 py-3 text-sm font-semibold transition-colors ${tab === 'nueva' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          + {editando ? 'Editando' : 'Nueva brigada'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">

        {/* ── LISTA ── */}
        {tab === 'lista' && (
          brigadas.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">🚶</p>
              <p className="text-slate-500 font-semibold">Sin brigadas registradas</p>
              <p className="text-slate-400 text-sm mt-1">Crea la primera brigada para asignar territorio.</p>
              <button
                onClick={openNueva}
                className="mt-5 bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Crear primera brigada
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(brigadasPorSector).sort(([a], [b]) => Number(a) - Number(b)).map(([sec, grupo]) => (
                <div key={sec}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
                    Sector {sec} — {grupo.length} equipo{grupo.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2.5">
                    {grupo.map(b => (
                      <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: b.color ?? '#3B82F6' }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm leading-tight">{b.nombre}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{b.slug}</span>
                              {' · '}{(b.secciones ?? []).length} secciones
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(b.secciones ?? []).sort((a, b) => a - b).map(s => (
                                <span
                                  key={s}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: b.color ?? '#3B82F6' }}
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleCopiarLink(b.slug)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                copiadoSlug === b.slug
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                              {copiadoSlug === b.slug ? '✓ Copiado' : 'Copiar link'}
                            </button>
                            <button
                              onClick={() => openEditar(b)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                              Editar
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleEliminar(b.id)}
                                className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── FORMULARIO ── */}
        {tab === 'nueva' && (
          <form onSubmit={handleGuardar} className="space-y-4">

            {/* Nombre */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Nombre del equipo
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Equipo Norte — Sector 8"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Sector (solo admin) */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Sector
                </label>
                <select
                  value={sector}
                  onChange={e => { setSector(Number(e.target.value)); setSecsSel([]); }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Sector {s}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Color */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Color del equipo
              </label>
              <div className="flex gap-2.5 flex-wrap">
                {COLORES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={`w-9 h-9 rounded-full border-[3px] transition-transform ${
                      color === c.value ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {/* Secciones */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Secciones ({secsSel.length} / {secciones.length})
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSecsSel([...secciones])}
                    className="text-[10px] font-bold text-blue-500 hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecsSel([])}
                    className="text-[10px] font-bold text-slate-400 hover:underline"
                  >
                    Ninguna
                  </button>
                </div>
              </div>
              {secciones.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Cargando secciones…</p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {secciones.map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => toggleSec(sec)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        secsSel.includes(sec)
                          ? 'text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      style={secsSel.includes(sec) ? { backgroundColor: color } : {}}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { resetForm(); setTab('lista'); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !nombre.trim() || secsSel.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear brigada'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Brigadeo;
