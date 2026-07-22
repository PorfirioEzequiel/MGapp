import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../supabase/client';
import ToggleStatusButton from './ToggleStatusButton';
import { useNavigate } from 'react-router-dom';

const PUESTO_BADGE = {
  SM: 'bg-blue-100 text-blue-700',
  SECCIONAL: 'bg-violet-100 text-violet-700',
  SP: 'bg-amber-100 text-amber-700',
  ENLACE: 'bg-teal-100 text-teal-700',
  ADMINISTRADOR: 'bg-slate-100 text-slate-700',
};

const Filtro = () => {
  const [poligono, setPoligono] = useState('');
  const [seccion, setSeccion] = useState('');
  const [puesto, setPuesto] = useState('');
  const [status, setStatus] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opciones, setOpciones] = useState({ poligonos: [], puestos: [], status: [] });
  const [poligonoSecciones, setPoligonoSecciones] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('ciudadania')
      .select('poligono, seccion, puesto, status')
      .order('seccion', { ascending: true })
      .order('poligono', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        const mapa = {};
        data.forEach(item => {
          if (!item.poligono) return;
          if (!mapa[item.poligono]) mapa[item.poligono] = new Set();
          if (item.seccion) mapa[item.poligono].add(item.seccion);
        });
        setOpciones({
          poligonos: [...new Set(data.map(i => i.poligono))].filter(Boolean).sort(),
          puestos: [...new Set(data.map(i => i.puesto))].filter(Boolean).sort(),
          status: [...new Set(data.map(i => i.status))].filter(Boolean).sort(),
        });
        setPoligonoSecciones(
          Object.fromEntries(Object.entries(mapa).map(([p, s]) => [p, [...s].sort()]))
        );
      });
  }, []);

  const seccionesDisponibles = useMemo(() => {
    if (!poligono) return [...new Set(Object.values(poligonoSecciones).flat())].sort();
    return poligonoSecciones[poligono] || [];
  }, [poligono, poligonoSecciones]);

  useEffect(() => {
    if (seccion && !seccionesDisponibles.includes(seccion)) setSeccion('');
  }, [seccionesDisponibles, seccion]);

  const manejarFiltro = async () => {
    setLoading(true);
    let query = supabase.from('ciudadania').select('*').order('poligono', { ascending: true });
    if (poligono) query = query.eq('poligono', poligono);
    if (seccion) query = query.eq('seccion', seccion);
    if (puesto) query = query.eq('puesto', puesto);
    if (status) query = query.eq('status', status);
    if (nombre) {
      query = query.or(
        `nombre.ilike.%${nombre}%,a_paterno.ilike.%${nombre}%,a_materno.ilike.%${nombre}%,curp.ilike.%${nombre}%`
      );
    }
    const { data, error } = await query;
    if (!error && data) setResultados(data);
    setLoading(false);
  };

  const limpiarFiltros = () => {
    setPoligono(''); setSeccion(''); setPuesto(''); setStatus(''); setNombre(''); setResultados([]);
  };

  const selCls =
    'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5">
        <h1 className="text-white font-bold text-xl">Ciudadanos</h1>
        <p className="text-blue-200 text-xs mt-0.5">Buscar y gestionar miembros de la estructura</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {/* Panel de filtros */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Filtros de búsqueda</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Sector</p>
              <select value={poligono} onChange={e => setPoligono(e.target.value)} className={selCls}>
                <option value="">Todos</option>
                {opciones.poligonos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Sección</p>
              <select value={seccion} onChange={e => setSeccion(e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {seccionesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Puesto</p>
              <select value={puesto} onChange={e => setPuesto(e.target.value)} className={selCls}>
                <option value="">Todos</option>
                {opciones.puestos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Estatus</p>
              <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
                <option value="">Todos</option>
                {opciones.status.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Buscar</p>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && manejarFiltro()}
                placeholder="Nombre, CURP…"
                className={selCls}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={manejarFiltro}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors"
            >
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              onClick={limpiarFiltros}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors"
            >
              Limpiar
            </button>
            <button
              onClick={() => navigate('/agregar')}
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              + Agregar SM
            </button>
          </div>
        </div>

        {/* Resultados */}
        {loading && (
          <div className="text-center py-12 text-slate-400">
            <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Buscando…</p>
          </div>
        )}

        {!loading && resultados.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Resultados</p>
              <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5 font-semibold">
                {resultados.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Sector', 'Sección', 'Fracción', 'Nombre', 'CURP', 'Puesto', 'Estatus', 'Acciones'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{r.poligono}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{r.seccion}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.ubt}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                        {r.nombre} {r.a_paterno} {r.a_materno}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">{r.curp}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PUESTO_BADGE[r.puesto] || 'bg-slate-100 text-slate-600'}`}>
                          {r.puesto}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ToggleStatusButton registroId={r.id} initialStatus={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/ciudadano/${r.id}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && resultados.length === 0 && (
          <div className="text-center py-20 text-slate-300">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-medium text-slate-400">Aplica filtros y presiona Buscar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Filtro;
