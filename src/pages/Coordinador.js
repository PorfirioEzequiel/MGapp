import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';
import ToggleStatusButtonCP from './ToggleStatusButtonCP';
import AFILIACION from '../data/afiliacion.json';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fullName = (p) => p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null;
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const mesLabel = (mes) => { const [y, m] = mes.split('-'); return `${MESES[Number(m)-1]} ${y.slice(2)}`; };
const pctNum = (a, b) => b ? Math.round((a / b) * 100) : 0;

const BRAND = '#7B1528';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  COMPROBADO:      { cls: 'bg-emerald-100 text-emerald-700', symbol: '✓' },
  FUERA_DE_TIEMPO: { cls: 'bg-amber-100 text-amber-700',    symbol: '!' },
  OMITIDO:         { cls: 'bg-red-100 text-red-600',         symbol: '✗' },
  PENDIENTE:       { cls: 'bg-slate-100 text-slate-400',     symbol: '–' },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IcoHome = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
  </svg>
);
const IcoMap = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
  </svg>
);
const IcoPeople = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const IcoClip = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const IcoSearch = () => (
  <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);
const IcoPlus = () => (
  <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IcoGift = () => (
  <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1016.875 9H12m0-4.125A2.625 2.625 0 107.125 9H12m0-4.125V9m0 0H4.875m7.125 0h7.125M3 9h18m-9 0v11.25" />
  </svg>
);
const IcoChevron = () => (
  <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// ── KPI Card (Bento style) ────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = 'slate', wide }) => {
  const isBrand = color === 'brand';
  const cfgMap = {
    brand:   { bg: 'border-0',              valClr: 'text-white',       lblClr: 'text-white/70', subClr: 'text-white/55' },
    emerald: { bg: 'bg-emerald-50/80 border border-emerald-100', valClr: 'text-emerald-800', lblClr: 'text-emerald-600', subClr: 'text-emerald-500' },
    red:     { bg: 'bg-red-50/80 border border-red-100',         valClr: 'text-red-700',     lblClr: 'text-red-500',     subClr: 'text-red-400' },
    amber:   { bg: 'bg-amber-50/80 border border-amber-100',     valClr: 'text-amber-800',   lblClr: 'text-amber-600',   subClr: 'text-amber-500' },
    slate:   { bg: 'bg-white border border-slate-100',           valClr: 'text-slate-900',   lblClr: 'text-slate-500',   subClr: 'text-slate-400' },
  };
  const cfg = cfgMap[color] || cfgMap.slate;
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 flex flex-col justify-between shadow-sm ${wide ? 'col-span-2' : ''} ${cfg.bg}`}
      style={{
        ...(isBrand ? { background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` } : {}),
        minHeight: wide ? 88 : 76,
      }}
    >
      <p className={`text-[9px] font-black uppercase tracking-[0.18em] leading-none ${cfg.lblClr}`}>{label}</p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className={`text-4xl font-black tabular-nums leading-none ${cfg.valClr}`}>{value ?? '—'}</p>
        {sub && <p className={`text-[11px] leading-snug text-right max-w-[55%] ${cfg.subClr}`}>{sub}</p>}
      </div>
    </div>
  );
};

// ── Growth bar chart ──────────────────────────────────────────────────────────
const GrowthChart = ({ data, meta }) => {
  if (!data.length) return <p className="text-sm text-slate-400 italic text-center py-3">Sin datos aún.</p>;
  const maxVal = Math.max(meta || 0, ...data.map(d => d.total));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative flex items-end gap-2 h-28 min-w-max px-1">
        {meta > 0 && (
          <div className="absolute left-0 right-0 border-t border-dashed border-slate-200 flex justify-end pointer-events-none"
            style={{ bottom: `${Math.min((meta / maxVal) * 100, 100)}%` }}>
            <span className="text-[10px] text-slate-400 bg-white px-1 -mt-2.5 font-medium">Meta {meta}</span>
          </div>
        )}
        {data.map((d, i) => {
          const h = maxVal ? (d.total / maxVal) * 100 : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={d.mes} className="flex flex-col items-center justify-end h-full w-8 group" title={`${mesLabel(d.mes)}: ${d.total}`}>
              {isLast && <span className="text-[11px] font-bold mb-0.5" style={{ color: BRAND }}>{d.total}</span>}
              <div className="w-6 rounded-t transition-all duration-500 group-hover:opacity-75"
                style={{ height: `${h}%`, backgroundColor: isLast ? BRAND : '#CBD5E1' }} />
              <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{mesLabel(d.mes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Section coverage row ──────────────────────────────────────────────────────
const SeccionRow = ({ seccion, sm, fracciones, onClick }) => {
  const pct = pctNum(sm, fracciones);
  const barColor = pct === 100 ? '#10B981' : pct >= 60 ? '#3B82F6' : pct >= 30 ? '#F59E0B' : '#EF4444';
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 text-left transition-all duration-150 active:scale-[0.98]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
        style={{ backgroundColor: barColor + '22', border: `1.5px solid ${barColor}40` }}>
        <span className="text-[13px] font-black leading-none" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-tight">Secc. {seccion}</p>
        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black tabular-nums leading-tight" style={{ color: barColor }}>
          {sm}<span className="text-slate-200 font-normal text-xs">/{fracciones}</span>
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">SM / fracs</p>
      </div>
      <div className="text-slate-300 flex-shrink-0 ml-0.5"><IcoChevron /></div>
    </button>
  );
};

// ── Bottom Tab Bar ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'resumen',     label: 'Inicio',       Icon: IcoHome },
  { key: 'mapa',        label: 'Mapa',          Icon: IcoMap },
  { key: 'actividades', label: 'Actividades',   Icon: IcoClip },
];

// ── Main component ────────────────────────────────────────────────────────────
const Coordinador = () => {
  const { state } = useLocation();
  const { usuario } = useParams();
  const navigate = useNavigate();

  const sessionUser = React.useMemo(() => {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }, []);
  const user = state?.user ?? (sessionUser?.usuario === usuario ? sessionUser : null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    if (user.puesto?.toLowerCase() !== 'sp') { navigate('/'); return; }
    if (user.usuario !== usuario) { navigate('/'); return; }
  }, [user, usuario, navigate]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab]                           = useState('resumen');
  const [loading, setLoading]                   = useState(true);
  const [promotores, setPromotores]             = useState([]);
  const [seccionesSector, setSeccionesSector]   = useState([]);
  const [fraccionesGeo, setFraccionesGeo]       = useState([]);
  const [ciudadanosGeo, setCiudadanosGeo]       = useState([]);
  const [catalogoFracciones, setCatalogoFracciones] = useState([]);
  const [actividades, setActividades]           = useState([]);
  const [evidencias, setEvidencias]             = useState([]);
  const [seccionFiltro, setSeccionFiltro]       = useState('');
  const [nombreFiltro, setNombreFiltro]         = useState('');
  const [resultados, setResultados]             = useState([]);
  const [loadingBusqueda, setLoadingBusqueda]   = useState(false);
  const [tabActividades, setTabActividades]     = useState('seccion');
  const [seccionMapa, setSeccionMapa]           = useState('');
  const [smFiltroLocal, setSmFiltroLocal]       = useState('');
  const [leftPanelOpen, setLeftPanelOpen]       = useState(true);
  const [fraccionesDeSec, setFraccionesDeSec]   = useState([]);
  const [smsDeSec, setSmsDeSec]                 = useState([]);
  const [regCountSec, setRegCountSec]           = useState(null);
  const [loadingSecInfo, setLoadingSecInfo]     = useState(false);
  const [focusCoords, setFocusCoords]           = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchPromotores(),
      fetchMapaSector(),
      fetchCatalogoFracciones(),
      fetchActividades(),
    ]).finally(() => setLoading(false));
  }, []);

  const fetchPromotores = async () => {
    const { data } = await supabase.from('ciudadania').select('*')
      .eq('poligono', user.poligono).eq('puesto', 'SM').eq('status', 'ACTIVO');
    if (data) { setPromotores(data); fetchEvidencias(); }
  };

  const fetchMapaSector = async () => {
    const { data: secData } = await supabase.from('secciones').select('*').eq('pologono', user.poligono);
    setSeccionesSector(secData ?? []);
    const nums = [...new Set((secData ?? []).map(s => s.seccion))];
    const [{ data: fracData }, { data: geoData }] = await Promise.all([
      supabase.from('fracciones').select('fraccion, seccion, geometry').in('seccion', nums.length ? nums : [-1]),
      supabase.from('ciudadania')
        .select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion')
        .eq('poligono', user.poligono).eq('status', 'ACTIVO').not('latitud', 'is', null),
    ]);
    setFraccionesGeo(fracData ?? []);
    setCiudadanosGeo(geoData ?? []);
  };

  const fetchCatalogoFracciones = async () => {
    const { data } = await supabase.from('ubt_catalogo').select('fraccion, seccion, poligono, sector');
    if (!data) return;
    setCatalogoFracciones(data.filter(f =>
      String(f.poligono) === String(user.poligono) || String(f.sector) === String(user.poligono)
    ));
  };

  const fetchActividades = async () => {
    const { data } = await supabase.from('actividades').select('*')
      .eq('puesto', 'SM').order('created_at', { ascending: false });
    setActividades(data ?? []);
  };

  const fetchEvidencias = async () => {
    const { data } = await supabase.from('evidencias_actividades').select('*').eq('poligono', user.poligono);
    setEvidencias(data ?? []);
  };

  // ── Fetch datos de sección seleccionada (misma fuente que TableroBoard) ───
  useEffect(() => {
    if (!seccionMapa) {
      setFraccionesDeSec([]); setSmsDeSec([]); setRegCountSec(null); setFocusCoords(null);
      return;
    }
    const sec = Number(seccionMapa);
    setLoadingSecInfo(true);
    Promise.all([
      supabase.from('ubt_catalogo').select('fraccion').eq('seccion', sec).order('fraccion', { ascending: true }),
      supabase.from('ciudadania').select('id, nombre, a_paterno, a_materno, ubt, latitud, longitud')
        .eq('puesto', 'SM').eq('seccion', sec).eq('status', 'ACTIVO').order('ubt', { ascending: true }),
      supabase.from('ciudadania').select('id', { count: 'exact', head: true })
        .eq('seccion', sec).eq('status', 'ACTIVO'),
    ]).then(([fracRes, smsRes, regRes]) => {
      setFraccionesDeSec(fracRes.data ?? []);
      setSmsDeSec(smsRes.data ?? []);
      setRegCountSec(regRes.count ?? 0);
    }).finally(() => setLoadingSecInfo(false));
  }, [seccionMapa]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const fraccionesConSM = useMemo(
    () => fraccionesGeo.map(f => ({ ...f, sm: promotores.find(p => p.ubt === f.fraccion) ?? null })),
    [fraccionesGeo, promotores]
  );

  const coberturaSeccion = useMemo(() => {
    const map = {};
    catalogoFracciones.forEach(f => {
      const sec = String(f.seccion);
      if (!map[sec]) map[sec] = { seccion: sec, fracciones: 0, sm: 0 };
      map[sec].fracciones++;
    });
    promotores.forEach(p => { const sec = String(p.seccion); if (map[sec]) map[sec].sm++; });
    return Object.values(map).sort((a, b) => Number(a.seccion) - Number(b.seccion));
  }, [catalogoFracciones, promotores]);

  const detalleFracciones = useMemo(() => {
    const smPorUbt = {};
    promotores.forEach(p => { if (p.ubt) smPorUbt[p.ubt] = p; });
    return [...catalogoFracciones]
      .sort((a, b) => Number(a.seccion) - Number(b.seccion) || String(a.fraccion).localeCompare(String(b.fraccion)))
      .map(f => ({ seccion: f.seccion, fraccion: f.fraccion, sm: smPorUbt[f.fraccion] || null }));
  }, [catalogoFracciones, promotores]);

  const metaFracciones  = catalogoFracciones.length;
  const cobertura       = pctNum(promotores.length, metaFracciones);
  const sinCubrir       = metaFracciones - promotores.length;

  const crecimientoSM = useMemo(() => {
    const porMes = {};
    promotores.forEach(p => {
      if (!p.ingreso_estructura) return;
      const d = new Date(p.ingreso_estructura);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      porMes[key] = (porMes[key] ?? 0) + 1;
    });
    let acc = 0;
    return Object.keys(porMes).sort().map(mes => { acc += porMes[mes]; return { mes, total: acc }; });
  }, [promotores]);

  const actSM = useMemo(() => actividades.filter(a => a.puesto === 'SM'), [actividades]);

  const reporteActSeccion = useMemo(() => {
    const secMap = {};
    promotores.forEach(p => {
      const sec = String(p.seccion || '?');
      if (!secMap[sec]) secMap[sec] = { seccion: sec, sms: [], total: 0 };
      secMap[sec].sms.push(p); secMap[sec].total++;
    });
    return Object.values(secMap).sort((a, b) => Number(a.seccion) - Number(b.seccion)).map(s => {
      const comprobados = actSM.reduce((acc, act) => {
        acc[act.id] = evidencias.filter(e => e.actividad_id === act.id && s.sms.some(sm => sm.id === e.ciudadano_id)).length;
        return acc;
      }, {});
      return { ...s, comprobados };
    });
  }, [promotores, evidencias, actSM]);

  const reporteActIndividual = useMemo(() => promotores.map(sm => {
    const acts = actSM.map(act => {
      const ev = evidencias.find(e => e.actividad_id === act.id && e.ciudadano_id === sm.id);
      let estado = 'PENDIENTE';
      if (ev) estado = ev.status;
      else if (act.fecha_limite && new Date() > new Date(act.fecha_limite)) estado = 'OMITIDO';
      return { ...act, estado };
    });
    return {
      sm, actividades: acts,
      comprobados: acts.filter(a => a.estado === 'COMPROBADO').length,
      fuera: acts.filter(a => a.estado === 'FUERA_DE_TIEMPO').length,
      omitidos: acts.filter(a => a.estado === 'OMITIDO').length,
    };
  }), [promotores, evidencias, actSM]);

  const smFiltrados = useMemo(() => {
    if (!smFiltroLocal.trim()) return promotores;
    const q = smFiltroLocal.toLowerCase();
    return promotores.filter(p => fullName(p).toLowerCase().includes(q) || String(p.seccion).includes(q) || String(p.ubt).toLowerCase().includes(q));
  }, [promotores, smFiltroLocal]);

  const manejarFiltro = async () => {
    setLoadingBusqueda(true);
    let q = supabase.from('ciudadania').select('*')
      .eq('poligono', user.poligono).eq('puesto', 'SM')
      .in('status', ['ACTIVO', 'SOLICITUD DE ALTA']).order('ubt', { ascending: true });
    if (seccionFiltro) q = q.eq('seccion', seccionFiltro);
    if (nombreFiltro)  q = q.ilike('nombre', `%${nombreFiltro}%`);
    const { data } = await q;
    setResultados(data ?? []);
    setLoadingBusqueda(false);
  };

  if (!user) return null;

  // ── Shared table styles ────────────────────────────────────────────────────
  const thCls = 'text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 px-4 py-3 whitespace-nowrap bg-slate-50 border-b border-slate-100';
  const tdCls = 'px-4 py-3 text-sm border-b border-slate-50';

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4" style={{ height: '100dvh', background: 'linear-gradient(135deg, #F8FAFC 0%, #FDF6F7 100%)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` }}>
        <span className="text-white text-xs font-black tracking-widest">SP</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 animate-spin" style={{ borderTopColor: BRAND }} />
        <p className="text-sm font-bold text-slate-500">Cargando sector {user.poligono}…</p>
        <p className="text-xs text-slate-400">Sistema de Monitoreo · Tecámac</p>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col select-none" style={{ height: '100dvh', backgroundColor: '#F4F5F7' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 border-b border-slate-100/80"
        style={{
          minHeight: 56,
          paddingTop: 'env(safe-area-inset-top)',
          background: `linear-gradient(135deg, #ffffff 0%, #fdf6f7 100%)`,
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        }}>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-[11px] font-black flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` }}>SP</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate leading-tight">{fullName(user)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <p className="text-[11px] text-slate-400 leading-none font-medium">Sector {user.poligono} · Tecámac</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/coordinador/agregar/${user.usuario}`, { state: { user } })}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white flex-shrink-0 transition-all active:scale-95 active:opacity-80 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` }}>
          <IcoPlus /> Agregar
        </button>
        {tab === 'mapa' && (
          <button
            onClick={() => setLeftPanelOpen(v => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-95 flex-shrink-0"
            style={leftPanelOpen
              ? { background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)`, color: '#fff', borderColor: 'transparent' }
              : { backgroundColor: '#F8FAFC', color: '#374151', borderColor: '#E2E8F0' }}>
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
        )}
      </header>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden relative">

        {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
        {tab === 'resumen' && (
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-4" style={{ paddingBottom: 24 }}>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="SM Activas" value={promotores.length}
                  sub={`de ${metaFracciones} fracciones meta`} color="brand" wide />
                <KpiCard label="Sin cubrir" value={sinCubrir}
                  color={sinCubrir > 0 ? 'red' : 'emerald'} />
                <KpiCard label="Cobertura" value={`${cobertura}%`}
                  color={cobertura >= 80 ? 'emerald' : cobertura >= 50 ? 'amber' : 'red'} />
              </div>

              {/* Progress */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Avance del sector</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      {sinCubrir > 0 ? `${sinCubrir} fracciones sin cubrir` : sinCubrir === 0 && metaFracciones > 0 ? '¡Cobertura completa!' : 'Sin datos del catálogo'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black tabular-nums leading-none"
                      style={{ color: cobertura >= 80 ? '#10B981' : cobertura >= 50 ? '#F59E0B' : BRAND }}>
                      {cobertura}%
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums font-medium">
                      {promotores.length}<span className="text-slate-200">/{metaFracciones || '—'}</span>
                    </p>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${cobertura}%`, background: cobertura >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' : cobertura >= 50 ? 'linear-gradient(90deg, #D97706, #F59E0B)' : `linear-gradient(90deg, ${BRAND}, #A52040)` }} />
                </div>
              </div>

              {/* Growth chart */}
              {crecimientoSM.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Crecimiento de SM</p>
                  <GrowthChart data={crecimientoSM} meta={metaFracciones} />
                </div>
              )}

              {/* Sections — click goes to map */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Cobertura por sección</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{coberturaSeccion.length} secciones</span>
                </div>
                {coberturaSeccion.length === 0
                  ? <p className="text-sm text-slate-400 italic text-center py-8">Sin datos del catálogo.</p>
                  : coberturaSeccion.map(s => (
                    <SeccionRow key={s.seccion} seccion={s.seccion} sm={s.sm} fracciones={s.fracciones}
                      onClick={() => { setSeccionMapa(String(s.seccion)); setTab('mapa'); }} />
                  ))
                }
              </div>

              {/* Apoyos action */}
              <button
                onClick={() => navigate(`/apoyos/${user.usuario}`, { state: { user } })}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-white transition-opacity active:opacity-80 shadow-sm"
                style={{ backgroundColor: '#059669' }}>
                <IcoGift />
                <span className="text-sm font-semibold flex-1 text-left">Apoyos y Programas Sociales</span>
                <IcoChevron />
              </button>

              {/* ── SM del sector ──────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SM del sector</p>
                    <p className="text-xs text-slate-400 mt-0.5">{promotores.length} activas · {sinCubrir} sin cubrir</p>
                  </div>
                  <span className="text-sm font-black px-2.5 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: BRAND }}>{promotores.length}</span>
                </div>

                {/* Buscador local rápido */}
                <div className="px-4 pt-3 pb-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IcoSearch />
                    </div>
                    <input
                      value={smFiltroLocal}
                      onChange={e => setSmFiltroLocal(e.target.value)}
                      placeholder="Buscar por nombre, sección o UBT…"
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 bg-slate-50 outline-none focus:border-slate-300 transition-colors"
                    />
                  </div>
                </div>

                {/* Lista de SM */}
                <div className="divide-y divide-slate-50/80">
                  {smFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">
                      {smFiltroLocal ? 'Sin coincidencias.' : 'Sin SM registradas.'}
                    </p>
                  ) : smFiltrados.slice(0, 30).map(r => (
                    <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 transition-colors"
                      style={{ WebkitTapHighlightColor: 'transparent' }}>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${BRAND}BB 0%, #A52040AA 100%)` }}>
                        {r.nombre?.[0]}{r.a_paterno?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">{r.nombre} {r.a_paterno}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">S.{r.seccion}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{r.ubt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ToggleStatusButtonCP registroId={r.id} initialStatus={r.status} />
                        <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl text-white transition-all active:scale-95"
                          style={{ backgroundColor: BRAND }}>
                          Ver
                        </button>
                      </div>
                    </div>
                  ))}
                  {smFiltrados.length > 30 && (
                    <p className="text-xs text-slate-400 text-center py-3">
                      Mostrando 30 de {smFiltrados.length}. Usa el buscador para filtrar.
                    </p>
                  )}
                </div>

                {/* Búsqueda avanzada */}
                <div className="px-4 pb-3 pt-1">
                  <button
                    onClick={() => { setSeccionFiltro(''); setNombreFiltro(smFiltroLocal); manejarFiltro(); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity active:opacity-80"
                    style={{ backgroundColor: BRAND + 'DD' }}>
                    <IcoSearch />
                    Búsqueda avanzada en base de datos
                  </button>
                </div>

                {/* Results from DB search */}
                {resultados.length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-600">Resultado BD</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{resultados.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50/80">
                      {resultados.map(r => (
                        <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ backgroundColor: '#64748B' }}>
                            {r.nombre?.[0]}{r.a_paterno?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{r.nombre} {r.a_paterno}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">S.{r.seccion}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{r.ubt}</span>
                            </div>
                          </div>
                          <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl text-white transition-all active:scale-95"
                            style={{ backgroundColor: BRAND }}>
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Actividades de trabajo del sector ─────────────────────── */}
              {actSM.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Actividades de trabajo del sector</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{actSM.length} activ.</span>
                  </div>

                  {/* Activity pills — one per activity with global completion rate */}
                  <div className="p-3 space-y-2.5">
                    {actSM.map(act => {
                      const totalSMs  = promotores.length;
                      const compTotal = reporteActSeccion.reduce((s, sec) => s + (sec.comprobados[act.id] || 0), 0);
                      const pctAct    = totalSMs ? Math.round((compTotal / totalSMs) * 100) : 0;
                      const barCol    = pctAct === 100 ? '#10B981' : pctAct >= 50 ? '#3B82F6' : pctAct > 0 ? '#F59E0B' : '#E2E8F0';
                      return (
                        <div key={act.id}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-semibold text-slate-700 truncate flex-1 mr-2">{act.nombre}</p>
                            <span className="text-[11px] font-bold tabular-nums flex-shrink-0"
                              style={{ color: pctAct === 100 ? '#10B981' : pctAct > 0 ? '#3B82F6' : '#94A3B8' }}>
                              {compTotal}/{totalSMs}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pctAct}%`, backgroundColor: barCol }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Per-section breakdown */}
                  {reporteActSeccion.length > 0 && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Sección</th>
                            <th className="text-center px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">SM</th>
                            {actSM.map(a => (
                              <th key={a.id} className="text-center px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap" title={a.nombre}>
                                {a.nombre.length > 10 ? a.nombre.slice(0, 10) + '…' : a.nombre}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {reporteActSeccion.map(s => (
                            <tr key={s.seccion} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">Secc. {s.seccion}</td>
                              <td className="px-2 py-2 text-xs text-center text-slate-500">{s.total}</td>
                              {actSM.map(a => {
                                const comp = s.comprobados[a.id] || 0;
                                const p    = s.total ? Math.round((comp / s.total) * 100) : 0;
                                return (
                                  <td key={a.id} className="px-2 py-2 text-center">
                                    <span className={`text-xs font-bold ${p === 100 ? 'text-emerald-600' : p > 0 ? 'text-blue-500' : 'text-slate-300'}`}>
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

                  <button
                    onClick={() => setTab('actividades')}
                    className="w-full py-2.5 text-xs font-bold border-t border-slate-100 transition-colors"
                    style={{ color: BRAND }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FDF6F7'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                    Ver detalle completo →
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── TAB: MAPA ────────────────────────────────────────────────────── */}
        {tab === 'mapa' && (
          <div className="h-full flex relative">

            <aside
              className="absolute top-0 left-0 bottom-0 z-10 flex flex-col bg-white border-r border-slate-100 shadow-xl transition-transform duration-300 ease-out overflow-y-auto"
              style={{
                width: 'min(85vw, 300px)',
                transform: leftPanelOpen ? 'translateX(0)' : 'translateX(-105%)',
              }}
            >
              <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none">Sector {user.poligono}</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{promotores.length} SM · {cobertura}% cobertura</p>
                  </div>
                  <button onClick={() => setLeftPanelOpen(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors active:scale-90">
                    <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Secciones</p>
                  <div className="flex flex-wrap gap-1">
                    {coberturaSeccion.map(s => {
                      const isActive = String(s.seccion) === seccionMapa;
                      const pct = pctNum(s.sm, s.fracciones);
                      const col = pct === 100 ? '#10B981' : pct >= 60 ? '#3B82F6' : pct >= 30 ? '#F59E0B' : '#EF4444';
                      return (
                        <button key={s.seccion}
                          onClick={() => setSeccionMapa(isActive ? '' : String(s.seccion))}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95"
                          style={isActive
                            ? { backgroundColor: BRAND, color: '#fff', borderColor: BRAND }
                            : { backgroundColor: col + '18', color: col, borderColor: col + '40' }}>
                          {s.seccion}
                        </button>
                      );
                    })}
                    {seccionMapa && (
                      <button onClick={() => setSeccionMapa('')}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-400 bg-white active:scale-95 transition-all">
                        Todo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-3 space-y-3">

                {!seccionMapa && (() => {
                  const fmtN   = n => n != null ? Number(n).toLocaleString('es-MX') : '—';
                  const pctStr = (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : null;

                  const totalNominal = seccionesSector.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
                  const totalPadron  = seccionesSector.reduce((s, x) => s + (Number(x.padron ?? x.padron_electoral) || 0), 0);
                  const totalHombres = seccionesSector.reduce((s, x) => s + (Number(x.hombres) || 0), 0);
                  const totalMujeres = seccionesSector.reduce((s, x) => s + (Number(x.mujeres) || 0), 0);
                  const smConUbicSec = promotores.filter(p => p.latitud && Number(p.latitud) !== 0 && !isNaN(Number(p.latitud))).length;

                  const afRows   = AFILIACION.filter(r => Number(r.sp) === Number(user.poligono));
                  const afSector = afRows.length > 0 ? {
                    afiliados:               afRows.reduce((s, r) => s + (r.afiliados || 0), 0),
                    credenciales_entregadas: afRows.reduce((s, r) => s + (r.credenciales_entregadas || 0), 0),
                  } : null;

                  return (
                    <>
                      {/* Stat cards — padrón electoral */}
                      {(() => {
                        const totalFracciones = fraccionesGeo.length;
                        const numSecciones    = seccionesSector.length;
                        const sinUbic         = promotores.length - smConUbicSec;
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { label: 'Lista Nominal', value: fmtN(totalNominal),          sub: null,              accent: true },
                                { label: 'Padrón',        value: fmtN(totalPadron),            sub: 'electoral' },
                                { label: 'Secciones',     value: numSecciones    || '—',       sub: 'en el sector' },
                                { label: 'Fracciones',    value: totalFracciones || '—',       sub: 'totales' },
                              ].map(k => (
                                <div key={k.label} className="rounded-xl p-3 flex flex-col gap-1"
                                  style={k.accent
                                    ? { background: 'linear-gradient(135deg,#1D4ED8 0%,#1E40AF 100%)' }
                                    : { background: '#fff', border: '1px solid #F1F5F9' }}>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] leading-none"
                                    style={{ color: k.accent ? '#BFDBFE' : '#64748B' }}>{k.label}</p>
                                  <p className="text-2xl font-bold tabular-nums leading-none"
                                    style={{ color: k.accent ? '#fff' : '#0F172A' }}>{k.value ?? '—'}</p>
                                  {k.sub && <p className="text-[11px] leading-none" style={{ color: k.accent ? '#93C5FD' : '#64748B' }}>{k.sub}</p>}
                                </div>
                              ))}
                            </div>

                            {/* SMs — Ubicadas — Sin ubicar */}
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { label: "SMs",           value: promotores.length, sub: 'activas',        color: BRAND },
                                { label: "SMs ubicadas",  value: smConUbicSec,      sub: 'con GPS',        color: '#10B981' },
                                { label: "Sin ubicar",    value: sinUbic,           sub: 'pendientes',     color: sinUbic > 0 ? '#F59E0B' : '#10B981' },
                              ].map(k => (
                                <div key={k.label} className="rounded-xl p-2.5 flex flex-col gap-0.5 bg-white border border-slate-100">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] leading-none text-slate-400">{k.label}</p>
                                  <p className="text-xl font-black tabular-nums leading-none" style={{ color: k.color }}>{k.value ?? '—'}</p>
                                  <p className="text-[10px] leading-none text-slate-400">{k.sub}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                      {/* Cobertura + Afiliación */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-blue-500" />
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Cobertura territorial</p>
                        </div>
                        {[
                          { label: 'Fracciones con SM', v: promotores.length, t: metaFracciones,    cls: '#3B82F6' },
                          { label: 'SMs con ubicación', v: smConUbicSec,      t: promotores.length, cls: '#10B981' },
                        ].map(({ label, v, t, cls }) => t ? (
                          <div key={label}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                              <span className="text-[11px] font-bold text-slate-700 tabular-nums">{v}<span className="text-slate-400 font-normal">/{t}</span></span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min((v / t) * 100, 100)}%`, backgroundColor: cls }} />
                            </div>
                          </div>
                        ) : null)}

                        {afSector && (
                          <div className="pt-2 mt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-teal-500" />
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Actividad · Afiliación</p>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mb-2">
                              <div className="bg-teal-50 rounded-lg p-2 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Afiliados</p>
                                <p className="text-xl font-bold tabular-nums text-teal-700">{fmtN(afSector.afiliados)}</p>
                              </div>
                              <div className="bg-teal-50 rounded-lg p-2 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Comprobadas</p>
                                <p className="text-xl font-bold tabular-nums text-teal-700">{fmtN(afSector.credenciales_entregadas)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entrega</span>
                              <span className="text-[10px] font-bold text-teal-700">{pctStr(afSector.credenciales_entregadas, afSector.afiliados)}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min((afSector.credenciales_entregadas / afSector.afiliados) * 100, 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Género agregado */}
                      {(totalHombres > 0 || totalMujeres > 0) && totalNominal > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-slate-400" />
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Lista nominal por género</p>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-50">
                            <span className="text-[11px] text-slate-500 font-medium">Total</span>
                            <span className="text-xs font-bold tabular-nums text-blue-600">{fmtN(totalNominal)}</span>
                          </div>
                          <div className="mt-1.5 pt-2 border-t border-slate-100">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                              {totalHombres > 0 && <div className="h-full bg-blue-400 transition-all" style={{ width: `${((totalHombres / totalNominal) * 100).toFixed(1)}%` }} />}
                              {totalMujeres > 0 && <div className="h-full bg-rose-400 transition-all" style={{ width: `${((totalMujeres / totalNominal) * 100).toFixed(1)}%` }} />}
                            </div>
                            <div className="flex justify-between mt-1 flex-wrap gap-1">
                              {totalHombres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block" />♂ {fmtN(totalHombres)}</span>}
                              {totalMujeres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-400 inline-block" />♀ {fmtN(totalMujeres)}</span>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Responsable SP */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-violet-500" />
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Responsable</p>
                        </div>
                        {(() => {
                          const name = fullName(user);
                          const initials = name ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
                          return (
                            <div className="flex items-center gap-2 py-0.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-violet-100 text-violet-600">{initials}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">SP</p>
                                <p className="text-xs font-semibold text-slate-700 truncate leading-snug">{name}</p>
                              </div>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-violet-100 text-violet-700">SP</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Secciones breakdown — click to drill into section */}
                      {coberturaSeccion.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-blue-500" />
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Cobertura por sección</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {coberturaSeccion.map(s => {
                              const pctSec = pctNum(s.sm, s.fracciones);
                              const barCol = pctSec === 100 ? '#10B981' : pctSec >= 60 ? '#3B82F6' : pctSec >= 30 ? '#F59E0B' : '#EF4444';
                              return (
                                <button key={s.seccion}
                                  onClick={() => setSeccionMapa(String(s.seccion))}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors active:scale-[0.98]"
                                  style={{ WebkitTapHighlightColor: 'transparent' }}>
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: barCol + '18', border: `1px solid ${barCol}40` }}>
                                    <span className="text-[11px] font-black leading-none" style={{ color: barCol }}>{pctSec}%</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 leading-tight">Sección {s.seccion}</p>
                                    <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${pctSec}%`, backgroundColor: barCol }} />
                                    </div>
                                  </div>
                                  <p className="text-xs font-black tabular-nums flex-shrink-0" style={{ color: barCol }}>
                                    {s.sm}<span className="text-slate-300 font-normal text-[10px]">/{s.fracciones}</span>
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {seccionMapa && (() => {
                  const secSelData  = seccionesSector.find(s => s.seccion === Number(seccionMapa));
                  // detalleSec built from fresh Supabase fetch (same as TableroBoard)
                  const smPorUbt    = Object.fromEntries(smsDeSec.map(p => [p.ubt, p]));
                  const detalleSec  = fraccionesDeSec.map(f => ({ fraccion: f.fraccion, seccion: Number(seccionMapa), sm: smPorUbt[f.fraccion] ?? null }));
                  const smConUbic   = smsDeSec.filter(p => p.latitud && Number(p.latitud) !== 0 && !isNaN(Number(p.latitud))).length;
                  const fracConSM   = detalleSec.filter(f => f.sm != null).length;
                  const padronTotal = secSelData?.padron ?? secSelData?.padron_electoral;
                  const afSec       = AFILIACION.find(r => r.seccion === Number(seccionMapa));
                  const fmtN        = n => n != null ? Number(n).toLocaleString('es-MX') : '—';
                  const pctStr      = (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : null;

                  return (
                    <>
                      {loadingSecInfo && (
                        <div className="space-y-2">
                          {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
                        </div>
                      )}

                      {!loadingSecInfo && (
                        <>
                          {/* Distrito Federal */}
                          {secSelData?.nombre_distrito_federal && (
                            <div className="rounded-xl px-3 py-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#93C5FD' }}>Distrito Federal</p>
                              <p className="text-xs font-semibold leading-snug" style={{ color: '#1E3A5F' }}>{secSelData.nombre_distrito_federal}</p>
                            </div>
                          )}

                          {/* Stat cards */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { label: 'Lista Nominal', value: fmtN(secSelData?.lista_nominal), sub: null, accent: true },
                              { label: 'Padrón',        value: fmtN(padronTotal),               sub: 'electoral' },
                              { label: 'Fracciones',    value: fraccionesDeSec.length || '—',   sub: null },
                              { label: 'SMs',           value: smsDeSec.length,                 sub: 'activos' },
                            ].map(k => (
                              <div key={k.label} className="rounded-xl p-3 flex flex-col gap-1"
                                style={k.accent
                                  ? { background: 'linear-gradient(135deg,#1D4ED8 0%,#1E40AF 100%)' }
                                  : { background: '#fff', border: '1px solid #F1F5F9' }}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] leading-none"
                                  style={{ color: k.accent ? '#BFDBFE' : '#64748B' }}>{k.label}</p>
                                <p className="text-2xl font-bold tabular-nums leading-none"
                                  style={{ color: k.accent ? '#fff' : '#0F172A' }}>{k.value ?? '—'}</p>
                                {k.sub && <p className="text-[11px] leading-none" style={{ color: k.accent ? '#93C5FD' : '#64748B' }}>{k.sub}</p>}
                              </div>
                            ))}
                          </div>

                          {/* Cobertura + Afiliación */}
                          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm space-y-2">
                            {detalleSec.length > 0 && (
                              <>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-blue-500" />
                                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Cobertura territorial</p>
                                </div>
                                {[
                                  { label: 'Fracciones con SM', v: fracConSM,  t: fraccionesDeSec.length,   cls: '#3B82F6' },
                                  { label: 'SMs con ubicación', v: smConUbic,  t: smsDeSec.length,          cls: '#10B981' },
                                  ...(regCountSec != null ? [{ label: 'Ciudadanos reg.', v: regCountSec, t: Number(secSelData?.lista_nominal) || regCountSec, cls: '#A78BFA' }] : []),
                                ].map(({ label, v, t, cls }) => t ? (
                                  <div key={label}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                                      <span className="text-[11px] font-bold text-slate-700 tabular-nums">{v}<span className="text-slate-400 font-normal">/{t}</span></span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min((v / t) * 100, 100)}%`, backgroundColor: cls }} />
                                    </div>
                                  </div>
                                ) : null)}
                              </>
                            )}

                            {/* Actividad · Afiliación */}
                            {afSec && (
                              <div className={detalleSec.length > 0 ? 'pt-2 mt-1 border-t border-slate-100' : ''}>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-teal-500" />
                                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Actividad · Afiliación</p>
                                </div>
                                <div className="grid grid-cols-2 gap-1 mb-2">
                                  <div className="bg-teal-50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Afiliados</p>
                                    <p className="text-xl font-bold tabular-nums text-teal-700">{fmtN(afSec.afiliados)}</p>
                                  </div>
                                  <div className="bg-teal-50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Comprobadas</p>
                                    <p className="text-xl font-bold tabular-nums text-teal-700">{fmtN(afSec.credenciales_entregadas)}</p>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entrega</span>
                                  <span className="text-[10px] font-bold text-teal-700">{pctStr(afSec.credenciales_entregadas, afSec.afiliados)}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min((afSec.credenciales_entregadas / afSec.afiliados) * 100, 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Responsable SP */}
                          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-violet-500" />
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Responsable</p>
                            </div>
                            {(() => {
                              const name = fullName(user);
                              const initials = name ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
                              return (
                                <div className="flex items-center gap-2 py-0.5">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-violet-100 text-violet-600">{initials}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">SP</p>
                                    <p className="text-xs font-semibold text-slate-700 truncate leading-snug">{name}</p>
                                  </div>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-violet-100 text-violet-700">SP</span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Lista nominal por género */}
                          {(secSelData?.hombres || secSelData?.mujeres) && (
                            <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-slate-400" />
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Lista nominal por género</p>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                                <span className="text-[11px] text-slate-500 font-medium">Total</span>
                                <span className="text-xs font-bold tabular-nums text-blue-600">{fmtN(secSelData.lista_nominal)}</span>
                              </div>
                              <div className="mt-1.5 pt-2 border-t border-slate-100">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                                  {secSelData.hombres > 0 && <div className="h-full bg-blue-400 transition-all" style={{ width: `${((secSelData.hombres / secSelData.lista_nominal) * 100).toFixed(1)}%` }} />}
                                  {secSelData.mujeres > 0 && <div className="h-full bg-rose-400 transition-all" style={{ width: `${((secSelData.mujeres / secSelData.lista_nominal) * 100).toFixed(1)}%` }} />}
                                </div>
                                <div className="flex justify-between mt-1 flex-wrap gap-1">
                                  {secSelData.hombres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block" />♂ {fmtN(secSelData.hombres)}</span>}
                                  {secSelData.mujeres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-400 inline-block" />♀ {fmtN(secSelData.mujeres)}</span>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Fracciones table */}
                          {detalleSec.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0 bg-blue-500" />
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Fracciones y promotores SM</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                      <th className="text-left px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Fracc.</th>
                                      <th className="text-left px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Promotora SM</th>
                                      <th className="px-2.5 py-2 w-6" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {detalleSec.map(f => {
                                      const hasCoords = f.sm?.latitud && Number(f.sm.latitud) !== 0 && !isNaN(Number(f.sm.latitud));
                                      const dot = f.sm ? (hasCoords ? 'bg-emerald-400' : 'bg-blue-400') : 'bg-slate-200';
                                      const handleRowClick = () => {
                                        if (!hasCoords) return;
                                        const lat = Number(f.sm.latitud), lng = Number(f.sm.longitud);
                                        setFocusCoords({ lat, lng, name: `${f.sm.nombre} ${f.sm.a_paterno}`, ubt: f.fraccion });
                                      };
                                      return (
                                        <tr key={f.fraccion}
                                          onClick={handleRowClick}
                                          className={`transition-colors ${hasCoords ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                                          <td className="px-2.5 py-2 font-bold text-[11px] text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                                              {f.fraccion}
                                            </div>
                                          </td>
                                          <td className="px-2.5 py-2 text-[11px] text-slate-600">
                                            {f.sm
                                              ? `${f.sm.nombre} ${f.sm.a_paterno}`
                                              : <span className="text-slate-300 italic text-[10px]">Sin asignar</span>}
                                          </td>
                                          <td className="px-2.5 py-2 text-center text-xs">
                                            {f.sm && (hasCoords ? '📍' : <span className="text-amber-400 font-bold">!</span>)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex gap-3 mt-1.5 px-1">
                                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Con ubicación</span>
                                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Sin ubicación</span>
                                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-200 inline-block" />Sin SM</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}

              </div>
            </aside>

            <div className="flex-1 min-w-0 h-full">
              {seccionesSector.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 animate-spin" style={{ borderTopColor: BRAND }} />
                  <p className="text-sm text-slate-400 font-medium">Cargando mapa del sector…</p>
                </div>
              ) : (
                <MapTerritorial
                  secciones={seccionesSector}
                  fraccionesGeo={fraccionesConSM}
                  ciudadanos={ciudadanosGeo}
                  selectedSeccion={seccionMapa ? Number(seccionMapa) : null}
                  onSelectSeccion={sec => { setSeccionMapa(String(sec.seccion)); setFocusCoords(null); }}
                  spName={fullName(user)}
                  focusCoords={focusCoords}
                  onClearFocus={() => setFocusCoords(null)}
                  controlsLeftOffset={leftPanelOpen ? 'min(85vw, 300px)' : 0}
                />
              )}
            </div>

          </div>
        )}


        {/* ── TAB: ACTIVIDADES ─────────────────────────────────────────────── */}
        {tab === 'actividades' && (
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-4" style={{ paddingBottom: 24 }}>
              {actSM.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                  <p className="text-sm text-slate-400 italic">Sin actividades asignadas actualmente.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Actividades de SM</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{actSM.length}</span>
                  </div>
                  {/* Sub-tabs */}
                  <div className="flex border-b border-slate-100">
                    {[['seccion','Por Sección'],['individual','Individual']].map(([k,l]) => (
                      <button key={k} onClick={() => setTabActividades(k)}
                        className="flex-1 py-3 text-xs font-bold border-b-2 transition-colors"
                        style={tabActividades === k
                          ? { color: BRAND, borderColor: BRAND }
                          : { color: '#94A3B8', borderColor: 'transparent' }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {tabActividades === 'seccion' && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className={thCls}>Sección</th>
                            <th className={thCls + ' text-center'}>SM</th>
                            {actSM.map(a => (
                              <th key={a.id} className={thCls + ' text-center'} title={a.nombre}>
                                {a.nombre.length > 12 ? a.nombre.slice(0,12)+'…' : a.nombre}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reporteActSeccion.map(s => (
                            <tr key={s.seccion} className="hover:bg-slate-50 transition-colors">
                              <td className={tdCls + ' font-bold text-slate-700'}>Secc. {s.seccion}</td>
                              <td className={tdCls + ' text-center text-slate-500'}>{s.total}</td>
                              {actSM.map(a => {
                                const comp = s.comprobados[a.id] || 0;
                                const p = s.total ? Math.round((comp/s.total)*100) : 0;
                                return (
                                  <td key={a.id} className="px-4 py-3 text-center border-b border-slate-50">
                                    <span className={`text-xs font-bold ${p===100?'text-emerald-600':p>0?'text-amber-600':'text-slate-400'}`}>
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
                          <tr>
                            <th className={thCls}>SM</th>
                            <th className={thCls}>UBT</th>
                            <th className={thCls + ' text-center'}>OK</th>
                            <th className={thCls + ' text-center'}>Tarde</th>
                            <th className={thCls + ' text-center'}>Omit.</th>
                            {actSM.map(a => (
                              <th key={a.id} className={thCls + ' text-center'} title={a.nombre}>
                                {a.nombre.length > 10 ? a.nombre.slice(0,10)+'…' : a.nombre}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reporteActIndividual.map(({ sm, actividades: acts, comprobados, fuera, omitidos }) => (
                            <tr key={sm.id} className="hover:bg-slate-50 transition-colors">
                              <td className={tdCls + ' font-medium text-slate-800 whitespace-nowrap'}>{sm.nombre} {sm.a_paterno}</td>
                              <td className={tdCls + ' font-mono text-slate-500 text-xs'}>{sm.ubt}</td>
                              <td className={tdCls + ' text-center font-bold text-emerald-600'}>{comprobados}</td>
                              <td className={tdCls + ' text-center font-bold text-amber-500'}>{fuera}</td>
                              <td className={tdCls + ' text-center font-bold text-red-500'}>{omitidos}</td>
                              {acts.map(a => {
                                const cfg = STATUS_CFG[a.estado] || STATUS_CFG.PENDIENTE;
                                return (
                                  <td key={a.id} className="px-4 py-3 text-center border-b border-slate-50">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.symbol}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────────── */}
      <nav className="flex-shrink-0 flex bg-white/95 border-t border-slate-100/80"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          minHeight: 56,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 -1px 0 rgba(0,0,0,0.04)',
        }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200 relative"
              style={{ color: active ? BRAND : '#94A3B8', WebkitTapHighlightColor: 'transparent' }}>
              {active && (
                <div className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl -z-10 transition-all duration-200"
                  style={{ backgroundColor: BRAND + '10' }} />
              )}
              <Icon s={active ? 21 : 19} />
              <span className="text-[10px] font-bold leading-none tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
};

export default Coordinador;
