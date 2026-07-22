import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';
import ToggleStatusButtonCP from './ToggleStatusButtonCP';

const fullName = (p) => (p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null);
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLabel = (mes) => { const [y, m] = mes.split('-'); return `${MESES[Number(m) - 1]} ${y.slice(2)}`; };
const pctNum = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── stat card (igual al tablero) ─────────────────────────────────────────────

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`rounded-xl p-3 flex flex-col gap-1 ${accent
    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200/50'
    : 'bg-white border border-slate-100 shadow-sm'}`}>
    <p className={`text-[9px] font-bold uppercase tracking-[0.12em] ${accent ? 'text-blue-200' : 'text-slate-400'}`}>{label}</p>
    <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-white' : 'text-slate-900'}`}>{value ?? '—'}</p>
    {sub && <p className={`text-[10px] ${accent ? 'text-blue-300' : 'text-slate-400'}`}>{sub}</p>}
  </div>
);

// ── gráfica de crecimiento ────────────────────────────────────────────────────

const CrecimientoChart = ({ data, meta }) => {
  if (!data.length) return <p className="text-sm text-slate-400 italic">Sin datos de crecimiento aún.</p>;
  const maxVal = Math.max(meta || 0, ...data.map(d => d.total));
  return (
    <div className="overflow-x-auto">
      <div className="relative flex items-end gap-2 h-28 min-w-max px-1">
        {meta > 0 && (
          <div className="absolute left-0 right-0 border-t border-dashed border-slate-300 flex justify-end pointer-events-none"
            style={{ bottom: `${Math.min((meta / maxVal) * 100, 100)}%` }}>
            <span className="text-[9px] text-slate-400 bg-white px-1 -mt-2">Meta: {meta}</span>
          </div>
        )}
        {data.map((d, i) => {
          const h = maxVal ? (d.total / maxVal) * 100 : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={d.mes} className="flex flex-col items-center justify-end h-full w-7" title={`${mesLabel(d.mes)}: ${d.total} SM`}>
              {isLast && <span className="text-[10px] font-bold text-blue-700 mb-0.5">{d.total}</span>}
              <div className="w-6 bg-blue-500 rounded-t transition-all duration-500" style={{ height: `${h}%` }} />
              <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{mesLabel(d.mes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── badge de estatus de actividad ─────────────────────────────────────────────

const STATUS_BADGE = {
  COMPROBADO: 'bg-emerald-100 text-emerald-700',
  FUERA_DE_TIEMPO: 'bg-amber-100 text-amber-700',
  OMITIDO: 'bg-red-100 text-red-600',
  PENDIENTE: 'bg-slate-100 text-slate-400',
};

// ── componente principal ──────────────────────────────────────────────────────

const Coordinador = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();
  const navigate = useNavigate();

  const [promotores, setPromotores] = useState([]);
  const [seccionesSector, setSeccionesSector] = useState([]);
  const [fraccionesGeo, setFraccionesGeo] = useState([]);
  const [ciudadanosGeo, setCiudadanosGeo] = useState([]);
  const [catalogoFracciones, setCatalogoFracciones] = useState([]);

  // Actividades
  const [actividades, setActividades] = useState([]);
  const [evidencias, setEvidencias] = useState([]);

  // Filtro SM
  const [seccionFiltro, setSeccionFiltro] = useState('');
  const [nombreFiltro, setNombreFiltro] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loadingBusqueda, setLoadingBusqueda] = useState(false);

  // Vista de la segunda tabla (resumen vs detalle)
  const [vistaTabla, setVistaTabla] = useState('resumen');

  // Tab actividades
  const [tabActividades, setTabActividades] = useState('seccion');

  // Mapa
  const [seccionMapa, setSeccionMapa] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchPromotores();
    fetchMapaSector();
    fetchCatalogoFracciones();
    fetchActividades();
  }, []);

  const fetchPromotores = async () => {
    const { data } = await supabase
      .from('ciudadania')
      .select('*')
      .eq('poligono', user.poligono)
      .eq('puesto', 'SM')
      .eq('status', 'ACTIVO');
    if (data) {
      setPromotores(data);
      fetchEvidencias(data);
    }
  };

  const fetchMapaSector = async () => {
    const { data: secData } = await supabase.from('secciones').select('*').eq('pologono', user.poligono);
    setSeccionesSector(secData ?? []);
    const nums = [...new Set((secData ?? []).map(s => s.seccion))];
    const { data: fracData } = await supabase.from('fracciones').select('fraccion, seccion, geometry').in('seccion', nums.length ? nums : [-1]);
    setFraccionesGeo(fracData ?? []);
    const { data: geoData } = await supabase.from('ciudadania').select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion').eq('poligono', user.poligono).eq('status', 'ACTIVO').not('latitud', 'is', null);
    setCiudadanosGeo(geoData ?? []);
  };

  const fetchCatalogoFracciones = async () => {
    const { data } = await supabase
      .from('ubt_catalogo')
      .select('fraccion, seccion, poligono, sector');
    if (!data) return;
    // Filtrar por sector del coordinador; soporta tanto 'poligono' como 'sector' como nombre de columna
    const mine = data.filter(f =>
      String(f.poligono) === String(user.poligono) ||
      String(f.sector) === String(user.poligono)
    );
    setCatalogoFracciones(mine);
  };

  const fetchActividades = async () => {
    const { data } = await supabase.from('actividades').select('*').order('created_at', { ascending: false });
    setActividades(data ?? []);
  };

  const fetchEvidencias = async () => {
    const { data } = await supabase
      .from('evidencias_actividades')
      .select('*')
      .eq('poligono', user.poligono);
    setEvidencias(data ?? []);
  };

  // SM en el mapa
  const fraccionesConSM = useMemo(
    () => fraccionesGeo.map(f => ({ ...f, sm: promotores.find(p => p.ubt === f.fraccion) ?? null })),
    [fraccionesGeo, promotores]
  );

  // ── Tabla 1: SECTOR | SECCION | FRACCIONES | SM | %SM ─────────────────────
  const coberturaSeccion = useMemo(() => {
    const map = {};
    catalogoFracciones.forEach(f => {
      const sec = String(f.seccion);
      if (!map[sec]) map[sec] = { seccion: sec, fracciones: 0, sm: 0 };
      map[sec].fracciones++;
    });
    promotores.forEach(p => {
      const sec = String(p.seccion);
      if (map[sec]) map[sec].sm++;
    });
    return Object.values(map).sort((a, b) => Number(a.seccion) - Number(b.seccion));
  }, [catalogoFracciones, promotores]);

  // ── Tabla 2: SECTOR | SECCION | FRACCION | SM (nombre) ────────────────────
  const detalleFracciones = useMemo(() => {
    const smPorUbt = {};
    promotores.forEach(p => { if (p.ubt) smPorUbt[p.ubt] = p; });
    return [...catalogoFracciones]
      .sort((a, b) => Number(a.seccion) - Number(b.seccion) || String(a.fraccion).localeCompare(String(b.fraccion)))
      .map(f => ({
        seccion: f.seccion,
        fraccion: f.fraccion,
        sm: smPorUbt[f.fraccion] || null,
      }));
  }, [catalogoFracciones, promotores]);

  const metaFracciones = catalogoFracciones.length;

  // ── Crecimiento acumulado de SM por mes ────────────────────────────────────
  const crecimientoSM = useMemo(() => {
    const porMes = {};
    promotores.forEach(p => {
      if (!p.ingreso_estructura) return;
      const d = new Date(p.ingreso_estructura);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      porMes[key] = (porMes[key] ?? 0) + 1;
    });
    let acumulado = 0;
    return Object.keys(porMes).sort().map(mes => { acumulado += porMes[mes]; return { mes, total: acumulado }; });
  }, [promotores]);

  // ── Reporte actividades por sección ───────────────────────────────────────
  const actSM = useMemo(() => actividades.filter(a => a.puesto === 'SM'), [actividades]);

  const reporteActSeccion = useMemo(() => {
    const seccionesMap = {};
    promotores.forEach(p => {
      const sec = String(p.seccion || '?');
      if (!seccionesMap[sec]) seccionesMap[sec] = { seccion: sec, sms: [], total: 0 };
      seccionesMap[sec].sms.push(p);
      seccionesMap[sec].total++;
    });
    return Object.values(seccionesMap).sort((a, b) => Number(a.seccion) - Number(b.seccion)).map(s => {
      const comprobados = actSM.reduce((acc, act) => {
        acc[act.id] = evidencias.filter(e => e.actividad_id === act.id && s.sms.some(sm => sm.id === e.ciudadano_id)).length;
        return acc;
      }, {});
      return { ...s, comprobados };
    });
  }, [promotores, evidencias, actSM]);

  const reporteActIndividual = useMemo(() => {
    return promotores.map(sm => {
      const acts = actSM.map(act => {
        const ev = evidencias.find(e => e.actividad_id === act.id && e.ciudadano_id === sm.id);
        let estado = 'PENDIENTE';
        if (ev) estado = ev.status;
        else if (act.fecha_limite && new Date() > new Date(act.fecha_limite)) estado = 'OMITIDO';
        return { ...act, estado };
      });
      return {
        sm,
        actividades: acts,
        comprobados: acts.filter(a => a.estado === 'COMPROBADO').length,
        fuera: acts.filter(a => a.estado === 'FUERA_DE_TIEMPO').length,
        omitidos: acts.filter(a => a.estado === 'OMITIDO').length,
      };
    });
  }, [promotores, evidencias, actSM]);

  // Secciones para el filtro de búsqueda
  const seccionesDelSector = useMemo(
    () => [...new Set(promotores.map(p => p.seccion).filter(Boolean))].sort((a, b) => a - b),
    [promotores]
  );

  const manejarFiltro = async () => {
    setLoadingBusqueda(true);
    let q = supabase.from('ciudadania').select('*').eq('poligono', user.poligono).eq('puesto', 'SM').in('status', ['ACTIVO', 'SOLICITUD DE ALTA']).order('ubt', { ascending: true });
    if (seccionFiltro) q = q.eq('seccion', seccionFiltro);
    if (nombreFiltro) q = q.ilike('nombre', `%${nombreFiltro}%`);
    const { data } = await q;
    setResultados(data ?? []);
    setLoadingBusqueda(false);
  };

  if (!user) return <p className="p-4 text-red-500">Usuario no encontrado.</p>;

  const cobertura = metaFracciones ? pctNum(promotores.length, metaFracciones) : 0;

  const thCls = "text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-3 whitespace-nowrap";
  const tdCls = "px-4 py-2.5 text-xs";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5">
        <p className="text-blue-200 text-xs font-medium">Coordinador — Sector {user.poligono}</p>
        <h1 className="text-white font-bold text-xl leading-tight">{fullName(user)}</h1>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="SM Activas" value={promotores.length} sub={`de ${metaFracciones} fracciones`} accent />
          <StatCard label="Sin SM" value={metaFracciones - promotores.length} sub="fracciones vacías" />
          <StatCard label="Cobertura" value={`${cobertura}%`} sub="del sector" />
        </div>

        {/* Barra + crecimiento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Crecimiento de SM</p>
            <span className="text-xs font-bold text-blue-700">{promotores.length}/{metaFracciones || '—'}</span>
          </div>
          {metaFracciones > 0 && (
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${cobertura}%` }} />
            </div>
          )}
          <CrecimientoChart data={crecimientoSM} meta={metaFracciones} />
        </div>

        {/* ── Reporte de cobertura ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <p className="text-sm font-bold text-slate-800 flex-1">Reporte de Cobertura</p>
            {/* Toggle resumen / detalle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {[['resumen', 'Por sección'], ['detalle', 'Por fracción']].map(([key, label]) => (
                <button key={key} onClick={() => setVistaTabla(key)}
                  className={`text-xs font-semibold px-3 py-1.5 transition-colors ${vistaTabla === key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla resumen: SECTOR | SECCION | FRACCIONES | SM | %SM */}
          {vistaTabla === 'resumen' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className={thCls}>Sector</th>
                    <th className={thCls}>Sección</th>
                    <th className={thCls}>Fracciones</th>
                    <th className={thCls}>SM</th>
                    <th className={thCls}>%SM</th>
                    <th className={thCls + " w-24"}>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {coberturaSeccion.map(s => {
                    const pct = pctNum(s.sm, s.fracciones);
                    const colorBar = pct === 100 ? 'bg-emerald-400' : pct >= 50 ? 'bg-blue-400' : 'bg-red-300';
                    const colorPct = pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-600' : 'text-red-500';
                    return (
                      <tr key={s.seccion} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className={tdCls + " font-semibold text-slate-600"}>{user.poligono}</td>
                        <td className={tdCls + " font-semibold text-slate-800 tabular-nums"}>{s.seccion}</td>
                        <td className={tdCls + " tabular-nums text-slate-500"}>{s.fracciones}</td>
                        <td className={tdCls + " tabular-nums font-bold text-slate-700"}>{s.sm}</td>
                        <td className={tdCls + " font-bold tabular-nums " + colorPct}>{pct}%</td>
                        <td className={tdCls}>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                            <div className={`h-full ${colorBar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {coberturaSeccion.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Sin datos del catálogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tabla detalle: SECTOR | SECCION | FRACCION | SM */}
          {vistaTabla === 'detalle' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className={thCls}>Sector</th>
                    <th className={thCls}>Sección</th>
                    <th className={thCls}>Fracción</th>
                    <th className={thCls}>SM</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleFracciones.map((f, i) => (
                    <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${!f.sm ? 'bg-red-50/40' : ''}`}>
                      <td className={tdCls + " text-slate-500"}>{user.poligono}</td>
                      <td className={tdCls + " tabular-nums text-slate-600"}>{f.seccion}</td>
                      <td className={tdCls + " font-mono text-xs text-slate-700"}>{f.fraccion}</td>
                      <td className={tdCls}>
                        {f.sm ? (
                          <span className="text-xs font-medium text-slate-800">
                            {f.sm.nombre} {f.sm.a_paterno} {f.sm.a_materno}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Sin SM</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {detalleFracciones.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Sin datos del catálogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate(`/coordinador/agregar/${user.usuario}`, { state: { user } })}
            className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            + Agregar Colaborador
          </button>
          <button onClick={() => navigate(`/apoyos/${user.usuario}`, { state: { user } })}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            🎁 Apoyos y Programas
          </button>
        </div>

        {/* Reporte de Actividades (si hay actividades SM) */}
        {actSM.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800">Actividades de SM</p>
            </div>
            <div className="flex border-b border-slate-100">
              {[['seccion', 'Por Sección'], ['individual', 'Individual']].map(([key, label]) => (
                <button key={key} onClick={() => setTabActividades(key)}
                  className={`flex-1 text-xs font-bold py-3 transition-colors ${tabActividades === key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-400 hover:text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tabActividades === 'seccion' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className={thCls}>Sección</th>
                      <th className={thCls + " text-center"}>SM</th>
                      {actSM.map(a => <th key={a.id} className={thCls + " text-center"} title={a.nombre}>{a.nombre.length > 14 ? a.nombre.slice(0, 14) + '…' : a.nombre}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {reporteActSeccion.map(s => (
                      <tr key={s.seccion} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className={tdCls + " font-bold text-slate-700"}>Secc. {s.seccion}</td>
                        <td className={tdCls + " text-center text-slate-500"}>{s.total}</td>
                        {actSM.map(a => {
                          const comp = s.comprobados[a.id] || 0;
                          const pct = s.total ? Math.round((comp / s.total) * 100) : 0;
                          return (
                            <td key={a.id} className="px-4 py-2.5 text-center">
                              <span className={`text-[11px] font-bold ${pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                {comp}/{s.total}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tabActividades === 'individual' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className={thCls}>SM</th>
                      <th className={thCls}>Fracc.</th>
                      <th className={thCls + " text-center"}>✓</th>
                      <th className={thCls + " text-center"}>⏰</th>
                      <th className={thCls + " text-center"}>✗</th>
                      {actSM.map(a => <th key={a.id} className={thCls + " text-center"} title={a.nombre}>{a.nombre.length > 12 ? a.nombre.slice(0, 12) + '…' : a.nombre}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {reporteActIndividual.map(({ sm, actividades: acts, comprobados, fuera, omitidos }) => (
                      <tr key={sm.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className={tdCls + " font-medium text-slate-800 whitespace-nowrap"}>{sm.nombre} {sm.a_paterno}</td>
                        <td className={tdCls + " font-mono text-slate-500"}>{sm.ubt}</td>
                        <td className={tdCls + " text-center font-bold text-emerald-600"}>{comprobados}</td>
                        <td className={tdCls + " text-center font-bold text-amber-500"}>{fuera}</td>
                        <td className={tdCls + " text-center font-bold text-red-500"}>{omitidos}</td>
                        {acts.map(a => (
                          <td key={a.id} className="px-4 py-2.5 text-center">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.estado] || STATUS_BADGE.PENDIENTE}`}>
                              {a.estado === 'COMPROBADO' ? '✓' : a.estado === 'FUERA_DE_TIEMPO' ? '⏰' : a.estado === 'OMITIDO' ? '✗' : '—'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Buscar SM */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Buscar SM</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Sección</p>
              <select value={seccionFiltro} onChange={e => setSeccionFiltro(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full">
                <option value="">Todas</option>
                {seccionesDelSector.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre</p>
              <input value={nombreFiltro} onChange={e => setNombreFiltro(e.target.value)} onKeyDown={e => e.key === 'Enter' && manejarFiltro()}
                placeholder="Buscar por nombre"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
            </div>
          </div>
          <button onClick={manejarFiltro} disabled={loadingBusqueda}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors">
            {loadingBusqueda ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {/* Resultados búsqueda */}
        {resultados.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">SM encontradas</p>
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5 font-semibold">{resultados.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Sección', 'Fracción', 'Nombre', 'Estatus', 'Acciones'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className={tdCls + " tabular-nums text-slate-500"}>{r.seccion}</td>
                      <td className={tdCls + " font-mono text-slate-500"}>{r.ubt}</td>
                      <td className={tdCls + " font-medium text-slate-800 whitespace-nowrap"}>{r.nombre} {r.a_paterno} {r.a_materno}</td>
                      <td className={tdCls}>
                        <ToggleStatusButtonCP registroId={r.id} initialStatus={r.status} />
                      </td>
                      <td className={tdCls}>
                        <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mapa del sector */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Mapa del Sector</p>
          </div>
          <div style={{ height: 520 }}>
            <MapTerritorial
              secciones={seccionesSector}
              fraccionesGeo={fraccionesConSM}
              ciudadanos={ciudadanosGeo}
              selectedSeccion={seccionMapa ? Number(seccionMapa) : null}
              onSelectSeccion={sec => setSeccionMapa(String(sec.seccion))}
              spName={fullName(user)}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Coordinador;
