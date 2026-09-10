import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase, { supabaseStorage as supabaseAdmin } from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';
import ToggleStatusButtonCP from './ToggleStatusButtonCP';
import AFILIACION from '../data/afiliacion.json';

// ── Splash screen (mismo estilo que VisorConsultor) ───────────────────────────
const SPLASH_MSGS = [
  'Accediendo al sector…',
  'Cargando estructura territorial…',
  'Preparando mapa…',
  'Iniciando…',
];
const SPLASH_CSS = `
  @keyframes sp-spin    { to { transform: rotate(360deg); } }
  @keyframes sp-float-a { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-28px) translateX(14px)} }
  @keyframes sp-float-b { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-18px) translateX(-22px)} }
  @keyframes sp-float-c { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(22px) translateX(16px)} }
  @keyframes sp-float-d { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-12px) translateX(-10px)} }
  @keyframes sp-exit    { to { opacity:0; transform:scale(1.012); } }
`;
const SplashScreen = ({ onDone }) => {
  const [msgIdx,  setMsgIdx]  = useState(0);
  const [fade,    setFade]    = useState(true);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        i += 1;
        if (i >= SPLASH_MSGS.length) { clearInterval(iv); setExiting(true); setTimeout(onDone, 580); return; }
        setMsgIdx(i); setFade(true);
      }, 300);
    }, 900);
    return () => clearInterval(iv);
  }, [onDone]);
  const pct = ((msgIdx + 1) / SPLASH_MSGS.length) * 100;
  return (
    <>
      <style>{SPLASH_CSS}</style>
      <div style={{ position:'fixed', inset:0, zIndex:50, background:'#0f172a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', animation: exiting ? 'sp-exit 0.55s cubic-bezier(0.4,0,1,1) forwards' : 'none' }}>
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.04, pointerEvents:'none' }}>
          <defs><pattern id="sp-dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="0.9" fill="white"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#sp-dots)"/>
        </svg>
        <div style={{ position:'absolute', top:'7%', left:'4%', width:340, height:340, borderRadius:'50%', border:'1px solid rgba(155,30,50,0.09)', animation:'sp-float-a 15s ease-in-out infinite', willChange:'transform', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'10%', right:'7%', width:190, height:190, borderRadius:'50%', background:'rgba(155,30,50,0.04)', animation:'sp-float-b 10s ease-in-out infinite', willChange:'transform', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:'52%', left:'13%', width:88, height:88, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.04)', animation:'sp-float-c 6.5s ease-in-out infinite', willChange:'transform', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', top:'18%', right:'16%', width:44, height:44, borderRadius:'50%', background:'rgba(155,30,50,0.08)', animation:'sp-float-d 4s ease-in-out infinite', willChange:'transform', pointerEvents:'none' }}/>
        <div style={{ marginBottom:44, textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:58, height:58, borderRadius:15, background:'#7B1528', marginBottom:16, boxShadow:'0 0 0 1px rgba(155,30,50,0.28), 0 10px 36px rgba(123,21,40,0.45)' }}>
            <span style={{ color:'#fff', fontWeight:900, fontSize:19, letterSpacing:'0.13em', fontFamily:'system-ui' }}>SM</span>
          </div>
          <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:17, letterSpacing:'-0.01em', fontFamily:'system-ui', marginBottom:3 }}>Sistema de Monitoreo</div>
          <div style={{ color:'rgba(148,163,184,0.65)', fontSize:11, fontWeight:600, letterSpacing:'0.26em', textTransform:'uppercase', fontFamily:'system-ui' }}>Tecámac · Estado de México</div>
        </div>
        <div style={{ position:'relative', marginBottom:34, zIndex:1 }}>
          <svg width="58" height="58" viewBox="0 0 58 58" style={{ display:'block', animation:'sp-spin 1.25s linear infinite' }}>
            <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"/>
            <circle cx="29" cy="29" r="24" fill="none" stroke="#9B1E32" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="37.7 113.1" transform="rotate(-90 29 29)"/>
          </svg>
        </div>
        <p style={{ fontSize:13, fontWeight:500, fontFamily:'system-ui', color:'rgba(203,213,225,0.8)', opacity: fade ? 1 : 0, transition:'opacity 0.3s ease', minHeight:20, marginBottom:20, position:'relative', zIndex:1 }}>{SPLASH_MSGS[msgIdx]}</p>
        <div style={{ width:152, height:1.5, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden', position:'relative', zIndex:1 }}>
          <div style={{ height:'100%', background:'#9B1E32', borderRadius:99, width:`${pct}%`, transition:'width 0.7s cubic-bezier(0.4,0,0.2,1)', boxShadow:'0 0 8px rgba(155,30,50,0.55)' }}/>
        </div>
      </div>
    </>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fullName = (p) => p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null;
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const mesLabel = (mes) => { const [y, m] = mes.split('-'); return `${MESES[Number(m)-1]} ${y.slice(2)}`; };
const pctNum = (a, b) => b ? Math.round((a / b) * 100) : 0;
const fmt    = (n)    => n != null ? Number(n).toLocaleString('es-MX') : '—';
const pct    = (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : null;

// ── Análisis político dinámico (Senaduría) ────────────────────────────────────
const buildSenadoInsight = (breakdown, groupLevel, scopeLabel) => {
  if (!breakdown || !breakdown.length) return null;
  const unidad     = groupLevel === 'seccion' ? 'secciones' : groupLevel === 'sector' ? 'sectores' : 'distritos';
  const unidadSing = groupLevel === 'seccion' ? 'sección'   : groupLevel === 'sector' ? 'sector'   : 'distrito';
  const ganados    = breakdown.filter(u => u.won).length;
  const total      = breakdown.length;
  const mejor      = breakdown[0];
  const peor       = breakdown[breakdown.length - 1];
  const partes     = [];
  partes.push(`En ${scopeLabel}, Mariela gana en ${ganados} de ${total} ${unidad} (${total ? Math.round((ganados / total) * 100) : 0}%).`);
  if (mejor) partes.push(`Su bastión más fuerte es ${mejor.label}, con ${mejor.margin >= 0 ? '+' : ''}${mejor.margin.toFixed(1)} pts sobre Fuerza x México.`);
  if (peor && peor.key !== mejor?.key) partes.push(peor.won
    ? `${peor.label} es el ${unidadSing} más competido: lo gana por apenas ${peor.margin.toFixed(1)} pts, conviene reforzarlo.`
    : `${peor.label} se pierde por ${Math.abs(peor.margin).toFixed(1)} pts — foco prioritario de movilización.`);
  return partes.join(' ');
};

const PARTY_FILL = { MORENA: '#6B0B20', PRI: '#F04E5A', PAN: '#1460A8', PRD: '#E8B200', PT: '#F07030', PVEM: '#22C55E', MC: '#F59E0B' };

const CANDIDATOS_2021 = {
  MORENA: { nombre: 'Mariela Gutiérrez Escalante',    partido: 'MORENA · PT · NAEM', resultado: 'GANADORA' },
  PRI:    { nombre: 'José Israel Ovando Becerra',     partido: 'PRI',                resultado: '2° lugar' },
  PAN:    { nombre: 'Sergio Octavio Germán Olivares', partido: 'PAN',                resultado: '3° lugar' },
  PT:     { nombre: 'Coalición PT · MORENA · NAEM',  partido: 'PT',                 resultado: '' },
  MC:     { nombre: 'Fabián Alfredo Varela Vergara',  partido: 'MC',                 resultado: '' },
  PVEM:   { nombre: 'Candidato PVEM',                 partido: 'PVEM',               resultado: '' },
  PRD:    { nombre: 'Candidato PRD',                  partido: 'PRD',                resultado: '' },
};
const CANDIDATOS_2024 = {
  ROSI:  { nombre: 'Rosa Yolanda Wong', partido: 'Rosa Yolanda Wong', resultado: 'GANADORA', fill: '#6B0B20', stroke: '#360008' },
  AARON: { nombre: 'Aaron Urbina',      partido: 'Aaron Urbina',      resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:    { nombre: 'Candidato MC',      partido: 'MC',                resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
  PT:    { nombre: 'Candidato PT',      partido: 'PT',                resultado: '',         fill: '#F07030', stroke: '#B84810' },
  PVEM:  { nombre: 'Candidato PVEM',    partido: 'PVEM',              resultado: '',         fill: '#22C55E', stroke: '#15803D' },
};
const CANDIDATOS_SENADO = {
  MARIELA: { nombre: 'Mariela Gutiérrez Escalante', partido: 'MORENA Coalición', resultado: 'GANADORA', fill: '#6B0B20', stroke: '#360008' },
  FUERZA:  { nombre: 'Fuerza x México',             partido: 'PAN · PRI · PRD',  resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:      { nombre: 'Candidato MC',                partido: 'MC',               resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
};
const CANDIDATOS_DIP = {
  MORENA: { nombre: 'Samuel Hernández Cruz',          partido: 'MORENA · PT · PVEM',       resultado: 'GANADOR', fill: '#6B0B20', stroke: '#360008' },
  PRI:    { nombre: 'Lilia Urbina / Eduardo Bernal',  partido: 'PRI · PAN · PRD · NAEM',   resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:     { nombre: 'Saúl Nayan / Noelia Hdz.',       partido: 'MC',                        resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
};
const SECTION_ALIASES = {
  7011: 4213, 7012: 4213, 7013: 4213, 7014: 4213, 7015: 4213, 7016: 4213, 7017: 4213,
  7018: 4228, 7019: 4228, 7020: 4228, 7021: 4228, 7022: 4228, 7023: 4228, 7024: 4228,
  6857: 4251, 6858: 4251, 6859: 4251, 6860: 4251, 6861: 4251,
  6862: 4251, 6863: 4251, 6864: 4251, 6865: 4251, 6866: 4251, 6867: 4251,
};
const IEEM_2024_GRUPOS = {
  6857: 4251, 6858: 4251, 6859: 4251, 6860: 4251, 6861: 4251,
  6862: 4251, 6863: 4251, 6864: 4251, 6865: 4251, 6866: 4251, 6867: 4251,
  7046: 4191, 7047: 4191, 7048: 4191, 7049: 4191, 7050: 4191, 7051: 4191, 7052: 4191, 7053: 4191,
  7054: 4208, 7055: 4208, 7056: 4208, 7057: 4208, 7058: 4208,
  7059: 4208, 7060: 4208, 7061: 4208, 7062: 4208, 7063: 4208,
};
const SUBS_4251 = Object.keys(IEEM_2024_GRUPOS).map(Number).filter(s => IEEM_2024_GRUPOS[s] === 4251);

const SectionTitle = ({ children, accent }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <div className={`w-0.5 h-3.5 rounded-full flex-shrink-0 ${accent ?? 'bg-blue-500'}`} />
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</p>
  </div>
);

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
const IcoCred = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);
const IcoStore = ({ s = 22 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
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
  { key: 'resumen', label: 'Listas Generales', Icon: IcoHome },
  { key: 'mapa',    label: 'Mapa',             Icon: IcoMap  },
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
  const [sheetSnap, setSheetSnap] = useState('peek'); // 'peek' | 'half' | 'full'
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const sheetRef    = useRef(null);
  const handleRef   = useRef(null);
  const dragRef     = useRef({ active: false, startY: 0, baseY: 0, containerH: 0, lastY: 0, lastT: 0, velocityY: 0 });
  const prevSnapRef = useRef(null);
  const [fraccionesDeSec, setFraccionesDeSec]   = useState([]);
  const [smsDeSec, setSmsDeSec]                 = useState([]);
  const [regCountSec, setRegCountSec]           = useState(null);
  const [loadingSecInfo, setLoadingSecInfo]     = useState(false);
  const [focusCoords, setFocusCoords]           = useState(null);
  const [electoralMode, setElectoralMode]       = useState(null);

  const [mercadoRows, setMercadoRows]               = useState([]);
  const [electoralData,         setElectoralData]         = useState({});
  const [electoralDataIEEM,     setElectoralDataIEEM]     = useState({});
  const [electoralData2024IEEM, setElectoralData2024IEEM] = useState({});
  const [electoralDataSenado,   setElectoralDataSenado]   = useState({});
  const [electoralDataDip2024,  setElectoralDataDip2024]  = useState({});

  const getSnapPx = (snap, h) => {
    if (snap === 'full') return Math.round(h * 0.03);
    if (snap === 'half') return Math.round(h * 0.50);
    return h - 84; // peek: 84px visibles
  };

  const onHandleTouchStart = (e) => {
    if (!sheetRef.current) return;
    const h  = sheetRef.current.parentElement?.clientHeight ?? window.innerHeight;
    // Cancel any in-progress CSS transition and capture current pixel position
    sheetRef.current.style.transition = 'none';
    const matrix = new DOMMatrix(getComputedStyle(sheetRef.current).transform);
    const baseY  = isNaN(matrix.m42) || matrix.m42 === 0 ? getSnapPx(sheetSnap, h) : matrix.m42;
    const startY = e.touches[0].clientY;
    dragRef.current = { active: true, startY, baseY, containerH: h, lastY: startY, lastT: Date.now(), velocityY: 0 };
  };

  const onHandleTouchEnd = (e) => {
    if (!dragRef.current.active || !sheetRef.current) return;
    dragRef.current.active = false;
    const dy  = e.changedTouches[0].clientY - dragRef.current.startY;
    const vel = dragRef.current.velocityY; // px/ms, positive = downward
    const FLICK = 0.35, THRESHOLD = 50;
    let next = sheetSnap;
    const goUp   = vel < -FLICK || (Math.abs(vel) < FLICK && dy < -THRESHOLD);
    const goDown = vel >  FLICK || (Math.abs(vel) < FLICK && dy >  THRESHOLD);
    if (goUp)   { if (sheetSnap === 'peek') next = 'half'; else if (sheetSnap === 'half') next = 'full'; }
    if (goDown) { if (sheetSnap === 'full') next = 'half'; else if (sheetSnap === 'half') next = 'peek'; }
    // Snap imperatively (no React re-render flash)
    const snapY = getSnapPx(next, dragRef.current.containerH);
    sheetRef.current.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
    sheetRef.current.style.transform  = `translateY(${snapY}px)`;
    setSheetSnap(next);
  };

  // ── Bloquear scroll del body en tab mapa para evitar que los gestos
  //    del mapa desplacen la shell de la app en móvil ──────────────────────────
  useEffect(() => {
    if (tab !== 'mapa') return;
    const body = document.body;
    const prev = { overflow: body.style.overflow, overscrollBehavior: body.style.overscrollBehavior };
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      body.style.overflow = prev.overflow;
      body.style.overscrollBehavior = prev.overscrollBehavior;
    };
  }, [tab]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Non-passive touchmove so e.preventDefault() actually works (React uses passive by default)
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (!dragRef.current.active || !sheetRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dy  = touch.clientY - dragRef.current.startY;
      const h   = dragRef.current.containerH;
      const raw = Math.max(getSnapPx('full', h), Math.min(h - 84, dragRef.current.baseY + dy));
      const now = Date.now();
      const dt  = now - dragRef.current.lastT;
      if (dt > 0) dragRef.current.velocityY = (touch.clientY - dragRef.current.lastY) / dt;
      dragRef.current.lastY = touch.clientY;
      dragRef.current.lastT = now;
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform  = `translateY(${raw}px)`;
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  // Drive snap position from state for non-drag snaps (button/chip clicks)
  useEffect(() => {
    if (!sheetRef.current) return;
    if (!isMobile) {
      // Clear any leftover mobile transform so desktop flex layout is unaffected
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform  = '';
      prevSnapRef.current = null;
      return;
    }
    if (dragRef.current.active) return;
    const el = sheetRef.current;
    const h  = el.parentElement?.clientHeight ?? window.innerHeight;
    const snapY = getSnapPx(sheetSnap, h);
    el.style.transition = prevSnapRef.current === null
      ? 'none'
      : 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform  = `translateY(${snapY}px)`;
    prevSnapRef.current = sheetSnap;
  }, [sheetSnap, isMobile]);

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

  const fetchMercado = async (sectionNums) => {
    if (!sectionNums?.length) return;
    const { data } = await supabaseAdmin
      .from('mercado')
      .select('seccion, entrega, mes, año, sector, piezas, sm_activas, entregadas, estatus, nombre')
      .in('seccion', sectionNums)
      .order('año', { ascending: false })
      .order('mes', { ascending: false });
    setMercadoRows(data ?? []);
  };

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
        .select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion, telefono_1, url_foto_perfil')
        .eq('poligono', user.poligono).eq('status', 'ACTIVO').not('latitud', 'is', null),
    ]);
    setFraccionesGeo(fracData ?? []);
    setCiudadanosGeo(geoData ?? []);
    fetchMercado(nums);
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
    const base = smFiltroLocal.trim()
      ? (() => { const q = smFiltroLocal.toLowerCase(); return promotores.filter(p => fullName(p).toLowerCase().includes(q) || String(p.seccion).includes(q) || String(p.ubt).toLowerCase().includes(q)); })()
      : promotores;
    return [...base].sort((a, b) => Number(a.seccion) - Number(b.seccion) || String(a.ubt).localeCompare(String(b.ubt), undefined, { numeric: true }));
  }, [promotores, smFiltroLocal]);

  // ── Capas del mapa ────────────────────────────────────────────────────────
  const afiliacionBySec = useMemo(() => {
    const m = {};
    AFILIACION.filter(r => Number(r.sp) === Number(user.poligono))
              .forEach(r => { m[r.seccion] = r; });
    return m;
  }, [user.poligono]);

  const mercadoBySec = useMemo(() => {
    if (!mercadoRows.length) return {};
    const bySec = {};
    for (const r of mercadoRows) {
      const sec = r.seccion;
      if (!sec) continue;
      if (!bySec[sec]) bySec[sec] = { total: 0, totalEntregadas: 0, totalPiezas: 0, estatusCounts: {}, rows: [] };
      bySec[sec].total           += Number(r.piezas ?? 0) * Number(r.sm_activas ?? 1);
      bySec[sec].totalEntregadas += Number(r.entregadas ?? 0);
      bySec[sec].totalPiezas     += Number(r.piezas ?? 0);
      bySec[sec].rows.push(r);
      const est = (r.estatus ?? 'PENDIENTE').toUpperCase();
      bySec[sec].estatusCounts[est] = (bySec[sec].estatusCounts[est] || 0) + 1;
    }
    const result = {};
    for (const [sec, v] of Object.entries(bySec)) {
      const deliveryRate = v.totalPiezas > 0 ? Math.min((v.totalEntregadas / v.totalPiezas) * 100, 100) : 0;
      const estatus = Object.entries(v.estatusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'PENDIENTE';
      result[Number(sec)] = {
        total:           v.total,
        totalEntregadas: v.totalEntregadas,
        totalPiezas:     v.totalPiezas,
        deliveryRate,
        estatus,
        estatusCounts:   v.estatusCounts,
        rows:            v.rows,
      };
    }
    return result;
  }, [mercadoRows]);

  // ── Electoral data fetches ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/electoral_2021.json').then(r => r.json()).then(rows => {
      const m = {}; rows.forEach(row => { m[row.seccion] = row; }); setElectoralData(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_2021_ieem.json').then(r => r.json()).then(rows => {
      const m = {}; rows.forEach(row => { m[row.seccion] = row; }); setElectoralDataIEEM(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_2024_ieem.json').then(r => r.json()).then(rows => {
      const m = {};
      rows.forEach(row => { m[row.seccion] = row; });
      const NUM_KEYS = ['rosi','aaron','mc','pt','pvem','total_validos','rosi_vs_aaron'];
      const agg4251 = { seccion: 4251, ganador: 'ROSI' };
      NUM_KEYS.forEach(k => { agg4251[k] = 0; });
      SUBS_4251.forEach(s => { if (m[s]) NUM_KEYS.forEach(k => { agg4251[k] += m[s][k] ?? 0; }); });
      agg4251.ganador = agg4251.rosi >= agg4251.aaron ? 'ROSI' : 'AARON';
      m[4251] = agg4251;
      setElectoralData2024IEEM(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_senado_2024.json').then(r => r.json()).then(rows => {
      const m = {};
      rows.forEach(row => { m[row.seccion] = row; });
      const SEN_KEYS = ['morena_coalicion','fuerza_x_mexico','mg_vs_fuerza','senado_mc','votos_nulos','casillas','lista_nominal','total_votos'];
      const firstSub = m[SUBS_4251[0]];
      const agg4251s = { seccion: 4251, distrito_federal: firstSub?.distrito_federal ?? 5 };
      SEN_KEYS.forEach(k => { agg4251s[k] = 0; });
      SUBS_4251.forEach(s => { if (m[s]) SEN_KEYS.forEach(k => { agg4251s[k] += m[s][k] ?? 0; }); });
      agg4251s.ganador = agg4251s.morena_coalicion >= agg4251s.fuerza_x_mexico ? 'MARIELA' : 'FUERZA';
      m[4251] = agg4251s;
      setElectoralDataSenado(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/dip_2024.json').then(r => r.json()).then(rows => {
      const m = {};
      rows.forEach(row => { m[row.seccion] = row; });
      const DIP_KEYS = ['morena','pri','mc','total','nulos','lista_nominal'];
      const agg4251 = { seccion: 4251, distrito: m[6857]?.distrito ?? 33 };
      DIP_KEYS.forEach(k => { agg4251[k] = 0; });
      SUBS_4251.forEach(s => { if (m[s]) DIP_KEYS.forEach(k => { agg4251[k] += m[s][k] ?? 0; }); });
      agg4251.ganador = agg4251.morena >= agg4251.pri && agg4251.morena >= agg4251.mc ? 'MORENA'
                      : agg4251.pri >= agg4251.mc ? 'PRI' : 'MC';
      m[4251] = agg4251;
      setElectoralDataDip2024(m);
    }).catch(() => {});
  }, []);

  // ── Estadísticas electorales — escopo sector SP ───────────────────────────
  const electoralStats = useMemo(() => {
    if (!electoralMode || electoralMode === 'semaforo_cred' || electoralMode === 'semaforo_mercado') return null;
    const isIEEM     = electoralMode === 'ayu_2021_ieem';
    const is2024IEEM = electoralMode === 'ayu_2024_ieem';
    const isSenado   = electoralMode === 'senado_2024';
    const isDip2024  = electoralMode === 'dip_2024';
    const dataSource = isIEEM ? electoralDataIEEM
                     : is2024IEEM ? electoralData2024IEEM
                     : isSenado ? electoralDataSenado
                     : isDip2024 ? electoralDataDip2024
                     : electoralData;

    if (!Object.keys(dataSource).length) return null;

    const groupLevel = seccionMapa ? null : 'seccion';

    const totals = {};
    let grandTotal = 0, secciones = 0;
    const secGanadas = {};
    const counted = new Set();
    let morena_solo_total = 0, pt_solo_total = 0, naem_solo_total = 0;
    let rosi_vs_aaron_total = 0, mg_vs_fuerza_total = 0, votos_nulos_total = 0;
    const senadoBuckets = {};

    const source = seccionMapa
      ? seccionesSector.filter(s => s.seccion === Number(seccionMapa))
      : seccionesSector;

    for (const s of source) {
      const canonical = ((is2024IEEM || isSenado || isDip2024) && IEEM_2024_GRUPOS[s.seccion])
        ? IEEM_2024_GRUPOS[s.seccion]
        : dataSource[s.seccion] !== undefined ? s.seccion : (SECTION_ALIASES[s.seccion] ?? s.seccion);
      if (counted.has(canonical)) continue;
      const d = dataSource[canonical];
      if (!d) continue;
      if (isDip2024 && d.distrito !== 33) continue;
      counted.add(canonical);
      secciones++;

      if (is2024IEEM) {
        const { ganador, rosi = 0, aaron = 0, mc = 0, pt = 0, pvem = 0, rosi_vs_aaron = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = { ROSI: rosi, AARON: aaron };
        if (mc > 0) votes.MC = mc; if (pt > 0) votes.PT = pt; if (pvem > 0) votes.PVEM = pvem;
        for (const [p, v] of Object.entries(votes)) { if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; } }
        rosi_vs_aaron_total += rosi_vs_aaron;
      } else if (isSenado) {
        const { ganador, morena_coalicion = 0, fuerza_x_mexico = 0, senado_mc = 0, mg_vs_fuerza = 0, votos_nulos = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = { MARIELA: morena_coalicion, FUERZA: fuerza_x_mexico };
        if (senado_mc > 0) votes.MC = senado_mc;
        for (const [p, v] of Object.entries(votes)) { if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; } }
        mg_vs_fuerza_total += mg_vs_fuerza;
        votos_nulos_total  += votos_nulos;
        if (groupLevel === 'seccion') {
          const groupKey = s.seccion;
          if (!senadoBuckets[groupKey]) senadoBuckets[groupKey] = { key: groupKey, secciones: 0, mariela: 0, fuerza: 0, mc: 0, total: 0, ganadas: 0 };
          const bucket = senadoBuckets[groupKey];
          bucket.secciones += 1; bucket.mariela += morena_coalicion; bucket.fuerza += fuerza_x_mexico;
          bucket.mc += senado_mc;
          bucket.total += morena_coalicion + fuerza_x_mexico + senado_mc;
          if (ganador === 'MARIELA') bucket.ganadas += 1;
        }
      } else if (isDip2024) {
        const { ganador, morena = 0, pri = 0, mc = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = {};
        if (morena > 0) votes.MORENA = morena; if (pri > 0) votes.PRI = pri; if (mc > 0) votes.MC = mc;
        for (const [p, v] of Object.entries(votes)) { if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; } }
      } else {
        const { ganador_partido, morena_coalicion = 0, morena = 0, pri = 0, pan = 0, pvem = 0, mc = 0, prd = 0, pt = 0, naem = 0 } = d;
        secGanadas[ganador_partido] = (secGanadas[ganador_partido] || 0) + 1;
        const morenaVotes = isIEEM ? morena_coalicion : morena;
        const votes = { MORENA: morenaVotes, PRI: pri, PAN: pan, PVEM: pvem, MC: mc, PRD: prd };
        if (!isIEEM && pt > 0) votes.PT = pt;
        for (const [p, v] of Object.entries(votes)) { if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; } }
        if (isIEEM) { morena_solo_total += morena; pt_solo_total += pt; naem_solo_total += naem; }
      }
    }

    if (!secciones) return null;
    const sorted       = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const winner       = sorted[0]?.[0];
    const marginVotos  = winner ? (totals[winner] - (sorted[1]?.[1] ?? 0)) : 0;
    const marginPct    = grandTotal ? ((marginVotos / grandTotal) * 100).toFixed(1) : '0';

    const senadoBreakdown = (isSenado && groupLevel === 'seccion')
      ? Object.values(senadoBuckets).map(b => {
          const marielaPct = b.total ? (b.mariela / b.total) * 100 : 0;
          const fuerzaPct  = b.total ? (b.fuerza  / b.total) * 100 : 0;
          return { key: b.key, label: `Sección ${b.key}`, secciones: b.secciones,
                   total: b.total, mariela: b.mariela, fuerza: b.fuerza,
                   marielaPct, fuerzaPct, margin: marielaPct - fuerzaPct, won: b.mariela > b.fuerza };
        }).sort((a, b) => b.margin - a.margin)
      : null;

    return { totals, grandTotal, winner, secGanadas, secciones, sorted, marginVotos, marginPct,
             isIEEM, is2024IEEM, isSenado, isDip2024,
             morena_solo_total, pt_solo_total, naem_solo_total,
             rosi_vs_aaron_total, mg_vs_fuerza_total, votos_nulos_total,
             groupLevel, senadoBreakdown };
  }, [electoralData, electoralDataIEEM, electoralData2024IEEM, electoralDataSenado,
      electoralDataDip2024, electoralMode, seccionesSector, seccionMapa]);

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
  if (loading) return <SplashScreen onDone={() => setLoading(false)} />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col select-none" style={{ height: '100dvh', backgroundColor: '#F4F5F7', overflow: 'hidden', overscrollBehavior: 'none' }}>

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
          <IcoPlus /> Alta de SM
        </button>
        {tab === 'mapa' && (
          <button
            onClick={() => isMobile
              ? setSheetSnap(s => s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek')
              : setLeftPanelOpen(o => !o)}
            className="flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-xl border transition-all active:scale-95 flex-shrink-0"
            style={sheetSnap !== 'peek'
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
          {isMobile ? (
            <div className="p-4 space-y-4" style={{ paddingBottom: 24 }}>

              {/* ── Resumen del sector ─────────────────────────────────── */}
              {(() => {
                const totalFracciones = fraccionesGeo.length;
                const cobSector  = pctNum(promotores.length, totalFracciones);
                const sinCubrirF = totalFracciones - promotores.length;
                const semCol = c => c >= 90 ? '#16A34A' : c >= 75 ? '#65A30D' : c >= 50 ? '#CA8A04' : c >= 25 ? '#EA580C' : '#DC2626';
                const semLbl = c => c >= 90 ? 'Excelente' : c >= 75 ? 'Bien' : c >= 50 ? 'Regular' : c >= 25 ? 'Bajo' : 'Crítico';
                const cobColor = totalFracciones > 0 ? semCol(cobSector) : '#9CA3AF';
                return (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Resumen del sector</p>
                          <p className="text-sm font-bold text-slate-800">Cobertura de SM</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                          style={{ backgroundColor: cobColor }}>{totalFracciones > 0 ? semLbl(cobSector) : 'Cargando…'}</span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cobColor }} />
                        Sector {user.poligono}
                      </p>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: BRAND + '10', borderColor: BRAND + '25' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: BRAND }}>SM Activas</p>
                          <p className="text-xl font-black tabular-nums" style={{ color: BRAND }}>{fmt(promotores.length)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 leading-none mb-1.5">Fracciones</p>
                          <p className="text-xl font-black tabular-nums text-blue-700">{totalFracciones || '—'}</p>
                        </div>
                        <div className={`rounded-xl p-3 text-center border ${sinCubrirF > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5 ${sinCubrirF > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Sin cubrir</p>
                          <p className={`text-xl font-black tabular-nums ${sinCubrirF > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{totalFracciones > 0 ? fmt(sinCubrirF) : '—'}</p>
                        </div>
                        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: cobColor + '12', borderColor: cobColor + '30' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: cobColor }}>Cobertura</p>
                          <p className="text-xl font-black tabular-nums" style={{ color: cobColor }}>{totalFracciones > 0 ? cobSector + '%' : '—'}</p>
                        </div>
                      </div>
                      {totalFracciones > 0 && (
                        <div>
                          <div className="h-2.5 rounded-full overflow-hidden bg-slate-100" />
                          <div className="h-2.5 rounded-full overflow-hidden -mt-2.5">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(cobSector, 100)}%`, backgroundColor: cobColor }} />
                          </div>
                          <p className="text-xs text-slate-400 text-center mt-1.5">
                            {fmt(promotores.length)} SM de {fmt(totalFracciones)} fracciones cubiertas
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Credenciales delivery analysis ─────────────────────── */}
              {(() => {
                const afRows = AFILIACION.filter(r => Number(r.sp) === Number(user.poligono));
                if (!afRows.length) return null;

                const totEntregadas  = afRows.reduce((s, r) => s + (r.entregadas_sp || 0), 0);
                const totComprobadas = afRows.reduce((s, r) => s + (r.comprobadas   || 0), 0);
                const totAfiliados   = afRows.reduce((s, r) => s + (r.afiliados     || 0), 0);
                const pct    = totEntregadas > 0 ? (totComprobadas / totEntregadas) * 100 : 0;
                const noData = totEntregadas === 0;

                const semaforoColor = p => p >= 90 ? '#16A34A' : p >= 75 ? '#65A30D' : p >= 50 ? '#CA8A04' : p >= 25 ? '#EA580C' : '#DC2626';
                const semaforoLabel = (p, nd) => nd ? 'Sin entregas' : p >= 90 ? 'Excelente' : p >= 75 ? 'Bien' : p >= 50 ? 'Regular' : p >= 25 ? 'Bajo' : 'Crítico';
                const barColor    = noData ? '#9CA3AF' : semaforoColor(pct);
                const statusLabel = semaforoLabel(pct, noData);

                const breakdown = afRows
                  .filter(r => (r.entregadas_sp || 0) > 0)
                  .map(r => ({
                    label: `Sec. ${r.seccion}`,
                    key:   r.seccion,
                    entregadas_sp: r.entregadas_sp,
                    comprobadas:   r.comprobadas,
                    pct: (r.comprobadas / r.entregadas_sp) * 100,
                  }))
                  .sort((a, b) => a.pct - b.pct);

                return (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Entrega de credenciales</p>
                          <p className="text-sm font-bold text-slate-800">Entregadas SP vs Comprobadas</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                          style={{ backgroundColor: barColor }}>{statusLabel}</span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: barColor }} />
                        Sector {user.poligono} · {afRows.length} secciones
                      </p>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* KPIs 2×2 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1.5">Afiliados</p>
                          <p className="text-xl font-black tabular-nums text-slate-700">{fmt(totAfiliados)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1.5">Entregadas al SP</p>
                          <p className="text-xl font-black tabular-nums text-amber-700">{fmt(totEntregadas)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-1.5">Comprobadas</p>
                          <p className="text-xl font-black tabular-nums text-emerald-700">{fmt(totComprobadas)}</p>
                        </div>
                        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: barColor + '12', borderColor: barColor + '30' }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: barColor }}>% Avance</p>
                          <p className="text-xl font-black tabular-nums" style={{ color: barColor }}>
                            {noData ? '—' : pct.toFixed(1) + '%'}
                          </p>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      {!noData && (
                        <div>
                          <div className="h-2.5 rounded-full overflow-hidden bg-slate-100" />
                          <div className="h-2.5 rounded-full overflow-hidden -mt-2.5">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                          </div>
                          <p className="text-xs text-slate-400 text-center mt-1.5">
                            {fmt(totComprobadas)} comprobadas de {fmt(totEntregadas)} entregadas al SP
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Mercado Solidario ──────────────────────────────────────── */}
              {mercadoRows.length > 0 && (() => {
                const secKeys = Object.keys(mercadoBySec).map(Number).sort((a, b) => a - b);
                const totalPiezas      = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalPiezas     ?? 0), 0);
                const totalEntregadas  = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalEntregadas ?? 0), 0);
                const seccionesActivas = secKeys.filter(k => (mercadoBySec[k]?.totalEntregadas ?? 0) > 0).length;

                const topSecKey = secKeys.length > 0
                  ? secKeys.reduce((best, k) =>
                      (mercadoBySec[k]?.totalEntregadas ?? 0) > (mercadoBySec[best]?.totalEntregadas ?? 0) ? k : best,
                      secKeys[0])
                  : null;
                const topSecEntregadas = topSecKey ? (mercadoBySec[topSecKey]?.totalEntregadas ?? 0) : 0;

                return (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Mercado Solidario</p>
                          <p className="text-sm font-bold text-slate-800">Distribución de piezas</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                          style={{ backgroundColor: BRAND }}>{seccionesActivas} activas</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Sector {user.poligono} · {secKeys.length} secciones en total
                      </p>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1.5">Total Piezas</p>
                          <p className="text-xl font-black tabular-nums text-slate-700">{fmt(totalPiezas)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1.5">Entregadas</p>
                          <p className="text-xl font-black tabular-nums text-amber-700">{fmt(totalEntregadas)}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 leading-none mb-1.5">Secciones</p>
                          <p className="text-xl font-black tabular-nums text-blue-700">{seccionesActivas}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-2">Sección con más entregas</p>
                          <p className="text-2xl font-black tabular-nums text-emerald-700 leading-none">{topSecKey ?? '—'}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mt-2.5 mb-1">Cantidad</p>
                          <p className="text-2xl font-black tabular-nums text-emerald-700 leading-none">{topSecKey ? fmt(topSecEntregadas) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">SM del sector</p>
                    <p className="text-sm text-slate-400 mt-0.5">{promotores.length} activas · {sinCubrir} sin cubrir</p>
                  </div>
                  <span className="text-sm font-black px-3 py-1 rounded-full text-white flex-shrink-0"
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
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 bg-slate-50 outline-none focus:border-slate-300 transition-colors"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                </div>

                {/* Lista de SM — tarjetas */}
                <div className="p-3 space-y-2.5" style={{ touchAction: 'pan-y' }}>
                  {smFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">
                      {smFiltroLocal ? 'Sin coincidencias.' : 'Sin SM registradas.'}
                    </p>
                  ) : smFiltrados.map(r => (
                    <div key={r.id}
                      className="bg-slate-50 rounded-2xl border border-slate-100 p-3 space-y-2.5"
                      style={{ WebkitTapHighlightColor: 'transparent' }}>
                      {/* Identidad */}
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl flex-shrink-0 shadow-sm overflow-hidden relative flex items-center justify-center text-sm font-black text-white"
                          style={{ background: `linear-gradient(135deg, ${BRAND}CC 0%, #A52040BB 100%)` }}>
                          {r.nombre?.[0]}{r.a_paterno?.[0]}
                          {r.url_foto_perfil && (
                            <img src={r.url_foto_perfil} alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none'; }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-bold text-slate-800 leading-snug">
                            {[r.nombre, r.a_paterno, r.a_materno].filter(Boolean).join(' ')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">Secc. {r.seccion}</span>
                            {r.ubt && <span className="text-xs text-slate-400 font-mono">{r.ubt}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Acciones */}
                      <div className="flex gap-2">
                        <ToggleStatusButtonCP registroId={r.id} initialStatus={r.status} />
                        <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                          className="flex-shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 transition-all active:scale-95">
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>


                {/* Results from DB search */}
                {resultados.length > 0 && (
                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-600">Resultado BD</p>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{resultados.length}</span>
                    </div>
                    <div className="p-3 space-y-2.5">
                      {resultados.map(r => (
                        <div key={r.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-3 space-y-2.5">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                              style={{ backgroundColor: '#64748B' }}>
                              {r.nombre?.[0]}{r.a_paterno?.[0]}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-sm font-bold text-slate-800 leading-snug">
                                {[r.nombre, r.a_paterno, r.a_materno].filter(Boolean).join(' ')}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">Secc. {r.seccion}</span>
                                {r.ubt && <span className="text-xs text-slate-400 font-mono">{r.ubt}</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                            className="w-full text-sm font-semibold py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 transition-all active:scale-95"
                            style={{ color: BRAND }}>
                            Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>


            </div>
            ) : (
            /* ── DESKTOP ───────────────────────────────────────────────── */
            <div className="p-6 flex gap-5 items-start" style={{ minHeight: '100%' }}>

              {/* LEFT: KPIs sidebar */}
              <div className="w-[340px] flex-shrink-0 space-y-4">

                {/* Resumen del sector */}
                {(() => {
                  const totalFracciones = fraccionesGeo.length;
                  const cobSector  = pctNum(promotores.length, totalFracciones);
                  const sinCubrirF = totalFracciones - promotores.length;
                  const semCol = c => c >= 90 ? '#16A34A' : c >= 75 ? '#65A30D' : c >= 50 ? '#CA8A04' : c >= 25 ? '#EA580C' : '#DC2626';
                  const semLbl = c => c >= 90 ? 'Excelente' : c >= 75 ? 'Bien' : c >= 50 ? 'Regular' : c >= 25 ? 'Bajo' : 'Crítico';
                  const cobColor = totalFracciones > 0 ? semCol(cobSector) : '#9CA3AF';
                  return (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Resumen del sector</p>
                            <p className="text-sm font-bold text-slate-800">Cobertura de SM</p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                            style={{ backgroundColor: cobColor }}>{totalFracciones > 0 ? semLbl(cobSector) : 'Cargando…'}</span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cobColor }} />
                          Sector {user.poligono}
                        </p>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: BRAND + '10', borderColor: BRAND + '25' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: BRAND }}>SM Activas</p>
                            <p className="text-xl font-black tabular-nums" style={{ color: BRAND }}>{fmt(promotores.length)}</p>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 leading-none mb-1.5">Fracciones</p>
                            <p className="text-xl font-black tabular-nums text-blue-700">{totalFracciones || '—'}</p>
                          </div>
                          <div className={`rounded-xl p-3 text-center border ${sinCubrirF > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5 ${sinCubrirF > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Sin cubrir</p>
                            <p className={`text-xl font-black tabular-nums ${sinCubrirF > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{totalFracciones > 0 ? fmt(sinCubrirF) : '—'}</p>
                          </div>
                          <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: cobColor + '12', borderColor: cobColor + '30' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: cobColor }}>Cobertura</p>
                            <p className="text-xl font-black tabular-nums" style={{ color: cobColor }}>{totalFracciones > 0 ? cobSector + '%' : '—'}</p>
                          </div>
                        </div>
                        {totalFracciones > 0 && (
                          <div>
                            <div className="h-2.5 rounded-full overflow-hidden bg-slate-100" />
                            <div className="h-2.5 rounded-full overflow-hidden -mt-2.5">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(cobSector, 100)}%`, backgroundColor: cobColor }} />
                            </div>
                            <p className="text-xs text-slate-400 text-center mt-1.5">
                              {fmt(promotores.length)} SM de {fmt(totalFracciones)} fracciones cubiertas
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Credenciales */}
                {(() => {
                  const afRows = AFILIACION.filter(r => Number(r.sp) === Number(user.poligono));
                  if (!afRows.length) return null;
                  const totEntregadas  = afRows.reduce((s, r) => s + (r.entregadas_sp || 0), 0);
                  const totComprobadas = afRows.reduce((s, r) => s + (r.comprobadas   || 0), 0);
                  const totAfiliados   = afRows.reduce((s, r) => s + (r.afiliados     || 0), 0);
                  const pct    = totEntregadas > 0 ? (totComprobadas / totEntregadas) * 100 : 0;
                  const noData = totEntregadas === 0;
                  const semColor = p => p >= 90 ? '#16A34A' : p >= 75 ? '#65A30D' : p >= 50 ? '#CA8A04' : p >= 25 ? '#EA580C' : '#DC2626';
                  const semLabel = (p, nd) => nd ? 'Sin entregas' : p >= 90 ? 'Excelente' : p >= 75 ? 'Bien' : p >= 50 ? 'Regular' : p >= 25 ? 'Bajo' : 'Crítico';
                  const barColor = noData ? '#9CA3AF' : semColor(pct);
                  return (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Entrega de credenciales</p>
                            <p className="text-sm font-bold text-slate-800">Entregadas SP vs Comprobadas</p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                            style={{ backgroundColor: barColor }}>{semLabel(pct, noData)}</span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: barColor }} />
                          Sector {user.poligono} · {afRows.length} secciones
                        </p>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1.5">Afiliados</p>
                            <p className="text-xl font-black tabular-nums text-slate-700">{fmt(totAfiliados)}</p>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1.5">Entregadas al SP</p>
                            <p className="text-xl font-black tabular-nums text-amber-700">{fmt(totEntregadas)}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-1.5">Comprobadas</p>
                            <p className="text-xl font-black tabular-nums text-emerald-700">{fmt(totComprobadas)}</p>
                          </div>
                          <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: barColor + '12', borderColor: barColor + '30' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5" style={{ color: barColor }}>% Avance</p>
                            <p className="text-xl font-black tabular-nums" style={{ color: barColor }}>{noData ? '—' : pct.toFixed(1) + '%'}</p>
                          </div>
                        </div>
                        {!noData && (
                          <div>
                            <div className="h-2.5 rounded-full overflow-hidden bg-slate-100" />
                            <div className="h-2.5 rounded-full overflow-hidden -mt-2.5">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-xs text-slate-400 text-center mt-1.5">
                              {fmt(totComprobadas)} comprobadas de {fmt(totEntregadas)} entregadas al SP
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Mercado Solidario */}
                {mercadoRows.length > 0 && (() => {
                  const secKeys = Object.keys(mercadoBySec).map(Number).sort((a, b) => a - b);
                  const totalPiezas      = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalPiezas     ?? 0), 0);
                  const totalEntregadas  = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalEntregadas ?? 0), 0);
                  const seccionesActivas = secKeys.filter(k => (mercadoBySec[k]?.totalEntregadas ?? 0) > 0).length;
                  const topSecKey = secKeys.length > 0
                    ? secKeys.reduce((best, k) => (mercadoBySec[k]?.totalEntregadas ?? 0) > (mercadoBySec[best]?.totalEntregadas ?? 0) ? k : best, secKeys[0])
                    : null;
                  const topSecEnt = topSecKey ? (mercadoBySec[topSecKey]?.totalEntregadas ?? 0) : 0;
                  return (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Mercado Solidario</p>
                            <p className="text-sm font-bold text-slate-800">Distribución de piezas</p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0" style={{ backgroundColor: BRAND }}>{seccionesActivas} activas</span>
                        </div>
                        <p className="text-xs text-slate-500">Sector {user.poligono} · {secKeys.length} secciones en total</p>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1.5">Total Piezas</p>
                            <p className="text-xl font-black tabular-nums text-slate-700">{fmt(totalPiezas)}</p>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1.5">Entregadas</p>
                            <p className="text-xl font-black tabular-nums text-amber-700">{fmt(totalEntregadas)}</p>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 leading-none mb-1.5">Secciones</p>
                            <p className="text-xl font-black tabular-nums text-blue-700">{seccionesActivas}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-2">Sección con más entregas</p>
                            <p className="text-2xl font-black tabular-nums text-emerald-700 leading-none">{topSecKey ?? '—'}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mt-2.5 mb-1">Cantidad</p>
                            <p className="text-2xl font-black tabular-nums text-emerald-700 leading-none">{topSecKey ? fmt(topSecEnt) : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Apoyos */}
                <button
                  onClick={() => navigate(`/apoyos/${user.usuario}`, { state: { user } })}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-white transition-opacity hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: '#059669' }}>
                  <IcoGift />
                  <span className="text-sm font-semibold flex-1 text-left">Apoyos y Programas Sociales</span>
                  <IcoChevron />
                </button>
              </div>

              {/* RIGHT: SM grid + Activities */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* SM section */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">SM del sector</p>
                      <p className="text-sm text-slate-400 mt-0.5">{promotores.length} activas · {sinCubrir} sin cubrir</p>
                    </div>
                    <div className="relative w-64">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IcoSearch /></div>
                      <input value={smFiltroLocal} onChange={e => setSmFiltroLocal(e.target.value)}
                        placeholder="Buscar por nombre, sección o UBT…"
                        className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 bg-slate-50 outline-none focus:border-slate-300 transition-colors" />
                    </div>
                    <span className="text-sm font-black px-3 py-1 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: BRAND }}>{smFiltrados.length}</span>
                  </div>

                  <div className="p-4 grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {smFiltrados.length === 0 ? (
                      <p className="col-span-full text-sm text-slate-400 italic text-center py-12">
                        {smFiltroLocal ? 'Sin coincidencias.' : 'Sin SM registradas.'}
                      </p>
                    ) : smFiltrados.map(r => (
                      <div key={r.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden relative flex items-center justify-center text-sm font-black text-white"
                            style={{ background: `linear-gradient(135deg, ${BRAND}CC 0%, #A52040BB 100%)` }}>
                            {r.nombre?.[0]}{r.a_paterno?.[0]}
                            {r.url_foto_perfil && (
                              <img src={r.url_foto_perfil} alt="" className="absolute inset-0 w-full h-full object-cover"
                                onError={e => { e.currentTarget.style.display = 'none'; }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 leading-snug">
                              {[r.nombre, r.a_paterno, r.a_materno].filter(Boolean).join(' ')}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">Secc. {r.seccion}</span>
                              {r.ubt && <span className="text-xs text-slate-400 font-mono">{r.ubt}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-auto">
                          <ToggleStatusButtonCP registroId={r.id} initialStatus={r.status} />
                          <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                            className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {resultados.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-600">Resultado BD</p>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{resultados.length}</span>
                      </div>
                      <div className="p-4 grid grid-cols-2 xl:grid-cols-3 gap-3">
                        {resultados.map(r => (
                          <div key={r.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
                                style={{ backgroundColor: '#64748B' }}>
                                {r.nombre?.[0]}{r.a_paterno?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 leading-snug">
                                  {[r.nombre, r.a_paterno, r.a_materno].filter(Boolean).join(' ')}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">Secc. {r.seccion}</span>
                                  {r.ubt && <span className="text-xs text-slate-400 font-mono">{r.ubt}</span>}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => navigate(`/ciudadano/${r.id}`)}
                              className="w-full text-sm font-semibold py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                              style={{ color: BRAND }}>
                              Editar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>
          )}
          </div>
        )}

        {/* ── TAB: MAPA ────────────────────────────────────────────────────── */}
        {tab === 'mapa' && (
          <div className={isMobile ? 'h-full relative overflow-hidden' : 'h-full flex'}>

            {/* Mapa */}
            <div className={isMobile ? 'absolute inset-0' : 'flex-1 h-full'} style={{ touchAction: 'none', overscrollBehavior: 'none', ...(!isMobile ? { order: 2 } : {}) }}>
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
                  controlsLeftOffset={0}
                  afiliacionBySec={afiliacionBySec}
                  hasMercado={mercadoRows.length > 0}
                  mercadoBySec={mercadoBySec}
                  electoralModeExternal={electoralMode}
                  onElectoralModeChange={setElectoralMode}
                  initialStyle="satelite"
                  gestureHandling="greedy"
                  readOnly
                />
              )}
            </div>

            {/* ── Panel: left sidebar (desktop) / bottom sheet (mobile) ────── */}
            <div
              ref={sheetRef}
              className={isMobile
                ? 'absolute inset-x-0 bottom-0 z-10 flex flex-col bg-white rounded-t-2xl'
                : 'flex-shrink-0 flex flex-col bg-white border-r border-slate-100 overflow-hidden'}
              style={isMobile ? {
                height: '100%',
                willChange: 'transform',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.13), 0 -1px 4px rgba(0,0,0,0.06)',
              } : {
                order: 1,
                width: leftPanelOpen ? 300 : 0,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: leftPanelOpen ? '2px 0 8px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {/* ── Mobile: drag handle + peek row + chips ──────────────── */}
              {isMobile && (
              <div
                ref={handleRef}
                className="flex-shrink-0 pt-2.5 pb-2 cursor-grab select-none"
                style={{ WebkitUserSelect: 'none' }}
                onTouchStart={onHandleTouchStart}
                onTouchEnd={onHandleTouchEnd}
              >
                {/* Handle pill + hint word */}
                <div className="flex flex-col items-center mb-2.5">
                  <div className="w-9 h-1 rounded-full bg-slate-200 mb-1.5" />
                  <span
                    className="text-[8px] font-bold uppercase tracking-[0.2em] select-none"
                    style={{
                      color: sheetSnap === 'peek' ? '#94A3B8' : '#CBD5E1',
                      transition: 'color 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}>
                    {sheetSnap === 'peek' ? 'Mostrar más' : 'Ocultar'}
                  </span>
                </div>

                {/* Peek row — siempre visible */}
                <div className="flex items-center justify-between px-4 pb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
                      style={{ background: seccionMapa ? '#334155' : `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` }}>
                      {seccionMapa ? (
                        <svg width={11} height={11} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                        </svg>
                      ) : 'SP'}
                    </div>
                    <div className="min-w-0">
                      {seccionMapa ? (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 leading-none">Sección {seccionMapa}</p>
                          <p className="text-[11px] font-bold text-slate-600 leading-snug mt-0.5">{smsDeSec.length} SM · {fraccionesDeSec.length} fracc.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 leading-none">Sector {user.poligono}</p>
                          <p className="text-xs font-bold text-slate-800 leading-snug mt-0.5">{promotores.length} SM activas</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {seccionMapa ? (
                      <button
                        onClick={() => setSeccionMapa('')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border active:scale-95 transition-all"
                        style={{ backgroundColor: '#FFF1F2', color: BRAND, borderColor: '#FECDD3' }}>
                        <svg width={10} height={10} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Todo el sector
                      </button>
                    ) : (
                      coberturaSeccion.length > 0 && (() => {
                        const totalSM  = coberturaSeccion.reduce((s, x) => s + x.sm, 0);
                        const totalFrac = coberturaSeccion.reduce((s, x) => s + x.fracciones, 0);
                        const cob = pctNum(totalSM, totalFrac);
                        const col = cob === 100 ? '#10B981' : cob >= 60 ? '#3B82F6' : cob >= 30 ? '#F59E0B' : '#EF4444';
                        return (
                          <span className="text-[11px] font-bold tabular-nums px-2 py-1 rounded-lg"
                            style={{ backgroundColor: col + '18', color: col }}>
                            {cob}% cob.
                          </span>
                        );
                      })()
                    )}
                    <button
                      onClick={() => setSheetSnap(s => s === 'peek' ? 'half' : 'peek')}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 active:scale-90 transition-all"
                      style={{ backgroundColor: '#F1F5F9' }}>
                      <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        style={{
                          transform: sheetSnap === 'peek' ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
                        }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Chips de sección */}
                <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1 border-t border-slate-100 mt-2">
                  {coberturaSeccion.map(s => {
                    const isActive = String(s.seccion) === seccionMapa;
                    const p = pctNum(s.sm, s.fracciones);
                    const col = p === 100 ? '#10B981' : p >= 60 ? '#3B82F6' : p >= 30 ? '#F59E0B' : '#EF4444';
                    return (
                      <button key={s.seccion}
                        onClick={() => { setSeccionMapa(isActive ? '' : String(s.seccion)); if (sheetSnap === 'peek') setSheetSnap('half'); }}
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
              )}

              {/* ── Desktop: panel header with chips ────────────────────── */}
              {!isMobile && (
                <div className="flex-shrink-0 px-3 py-3 border-b border-slate-100" style={{ minWidth: 300 }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[8px] font-black flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #A52040 100%)` }}>SP</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 leading-none">Sector {user.poligono}</p>
                      <p className="text-[11px] font-bold text-slate-800 leading-snug mt-0.5">{promotores.length} SM activas</p>
                    </div>
                    {coberturaSeccion.length > 0 && (() => {
                      const totalSM   = coberturaSeccion.reduce((s, x) => s + x.sm, 0);
                      const totalFrac = coberturaSeccion.reduce((s, x) => s + x.fracciones, 0);
                      const cob = pctNum(totalSM, totalFrac);
                      const col = cob === 100 ? '#10B981' : cob >= 60 ? '#3B82F6' : cob >= 30 ? '#F59E0B' : '#EF4444';
                      return (
                        <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: col + '18', color: col }}>
                          {cob}% cob.
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {coberturaSeccion.map(s => {
                      const isActive = String(s.seccion) === seccionMapa;
                      const p = pctNum(s.sm, s.fracciones);
                      const col = p === 100 ? '#10B981' : p >= 60 ? '#3B82F6' : p >= 30 ? '#F59E0B' : '#EF4444';
                      return (
                        <button key={s.seccion}
                          onClick={() => setSeccionMapa(isActive ? '' : String(s.seccion))}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-all hover:opacity-80"
                          style={isActive
                            ? { backgroundColor: BRAND, color: '#fff', borderColor: BRAND }
                            : { backgroundColor: col + '18', color: col, borderColor: col + '40' }}>
                          {s.seccion}
                        </button>
                      );
                    })}
                    {seccionMapa && (
                      <button onClick={() => setSeccionMapa('')}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-400 bg-white hover:bg-slate-50 transition-all">
                        Todo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Contenido scrollable ────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3" style={!isMobile ? { minWidth: 300 } : {}}>

                {/* ── Capa activa: Entrega de credenciales ─────────────── */}
                {electoralMode === 'semaforo_cred' && (() => {
                  const semColor = p =>
                    p >= 90 ? '#16A34A' : p >= 75 ? '#65A30D' : p >= 50 ? '#CA8A04' : p >= 25 ? '#EA580C' : '#DC2626';
                  const semLabel = (p, nd) =>
                    nd ? 'Sin entregas' : p >= 90 ? 'Excelente' : p >= 75 ? 'Bien' : p >= 50 ? 'Regular' : p >= 25 ? 'Bajo' : 'Crítico';

                  const SCALE = [
                    { label: 'Excelente', range: '≥ 90%',  color: '#16A34A' },
                    { label: 'Bien',      range: '75–89%', color: '#65A30D' },
                    { label: 'Regular',   range: '50–74%', color: '#CA8A04' },
                    { label: 'Bajo',      range: '25–49%', color: '#EA580C' },
                    { label: 'Crítico',   range: '< 25%',  color: '#DC2626' },
                  ];

                  // ── Vista sección seleccionada ──────────────────────────
                  if (seccionMapa) {
                    const r = AFILIACION.find(x => x.seccion === Number(seccionMapa));
                    if (!r) return (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                        <p className="text-[10px] text-slate-400 italic">Sin datos para sección {seccionMapa}</p>
                      </div>
                    );

                    const pct    = r.entregadas_sp > 0 ? (r.comprobadas / r.entregadas_sp) * 100 : 0;
                    const noData = (r.entregadas_sp || 0) === 0;
                    const barColor    = noData ? '#9CA3AF' : semColor(pct);
                    const statusLabel = semLabel(pct, noData);

                    return (
                      <>
                        {/* Cabecera sección */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Entrega de credenciales</p>
                              <p className="text-xs font-bold text-slate-800">Sección {seccionMapa}</p>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                              style={{ backgroundColor: barColor }}>{statusLabel}</span>
                          </div>
                          <button onClick={() => setSeccionMapa('')}
                            className="mt-1.5 text-[9px] font-bold flex items-center gap-1 transition-colors"
                            style={{ color: BRAND }}>
                            ← Ver todo el sector
                          </button>
                        </div>

                        {/* KPIs sección */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: 'Afiliados',      v: r.afiliados,            bg: 'bg-slate-50 border border-slate-100', txt: 'text-slate-700',   lbl: 'text-slate-400' },
                            { label: 'Entregadas SP',  v: r.entregadas_sp,        bg: 'bg-amber-50',                         txt: 'text-amber-700',   lbl: 'text-amber-500' },
                            { label: 'Comprobadas',    v: r.comprobadas,          bg: 'bg-emerald-50',                       txt: 'text-emerald-700', lbl: 'text-emerald-600' },
                            { label: 'En stock',       v: r.en_stock,             bg: 'bg-blue-50',                          txt: 'text-blue-700',    lbl: 'text-blue-500' },
                            { label: 'Sin entregar',   v: r.sin_entregar,         bg: 'bg-red-50',                           txt: 'text-red-700',     lbl: 'text-red-400' },
                            { label: 'Sin datos',      v: r.sin_datos,            bg: 'bg-slate-50 border border-slate-100', txt: 'text-slate-500',   lbl: 'text-slate-400' },
                          ].map(({ label, v, bg, txt, lbl }) => (
                            <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
                              <p className={`text-[8px] font-bold uppercase tracking-widest leading-none mb-1 ${lbl}`}>{label}</p>
                              <p className={`text-base font-black tabular-nums ${txt}`}>{fmt(v)}</p>
                            </div>
                          ))}
                        </div>

                        {/* Barra de progreso sección */}
                        {!noData && (
                          <div>
                            <div className="h-2 rounded-full overflow-hidden"
                              style={{ background: 'linear-gradient(90deg,#DC2626 0%,#CA8A04 40%,#65A30D 75%,#16A34A 100%)', opacity: 0.15 }} />
                            <div className="h-2 rounded-full overflow-hidden -mt-2">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[8px] text-slate-300">0%</span>
                              <span className="text-[8px] font-bold" style={{ color: barColor }}>{pct.toFixed(1)}% comprobado</span>
                              <span className="text-[8px] text-slate-300">100%</span>
                            </div>
                          </div>
                        )}

                      </>
                    );
                  }

                  // ── Vista sector completo ───────────────────────────────
                  const afRows         = AFILIACION.filter(r => Number(r.sp) === Number(user.poligono));
                  const totEntregadas  = afRows.reduce((s, r) => s + (r.entregadas_sp || 0), 0);
                  const totComprobadas = afRows.reduce((s, r) => s + (r.comprobadas   || 0), 0);
                  const totAfiliados   = afRows.reduce((s, r) => s + (r.afiliados     || 0), 0);
                  const pct    = totEntregadas > 0 ? (totComprobadas / totEntregadas) * 100 : 0;
                  const noData = totEntregadas === 0;
                  const barColor    = noData ? '#9CA3AF' : semColor(pct);
                  const statusLabel = semLabel(pct, noData);

                  const breakdown = afRows
                    .filter(r => (r.entregadas_sp || 0) > 0)
                    .map(r => ({
                      key:           r.seccion,
                      label:         `Sec. ${r.seccion}`,
                      entregadas_sp: r.entregadas_sp,
                      comprobadas:   r.comprobadas,
                      pct:           (r.comprobadas / r.entregadas_sp) * 100,
                    }))
                    .sort((a, b) => a.pct - b.pct);

                  return (
                    <>
                      {/* Cabecera sector */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Entrega de credenciales</p>
                            <p className="text-xs font-bold text-slate-800 leading-snug">Entregadas SP vs Comprobadas</p>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white"
                            style={{ backgroundColor: barColor }}>{statusLabel}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: barColor }} />
                          Sector {user.poligono} · {afRows.length} secciones · toca una para ver detalle
                        </p>
                      </div>

                      {/* KPIs sector */}
                      <div className="grid grid-cols-3 gap-1">
                        <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Afiliados</p>
                          <p className="text-sm font-black tabular-nums text-slate-700">{fmt(totAfiliados)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1">Entregadas</p>
                          <p className="text-sm font-black tabular-nums text-amber-700">{fmt(totEntregadas)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-1">Comprobadas</p>
                          <p className="text-sm font-black tabular-nums text-emerald-700">{fmt(totComprobadas)}</p>
                        </div>
                      </div>

                      {/* Barra de progreso sector */}
                      {!noData && (
                        <div>
                          <div className="h-2 rounded-full overflow-hidden"
                            style={{ background: 'linear-gradient(90deg,#DC2626 0%,#CA8A04 40%,#65A30D 75%,#16A34A 100%)', opacity: 0.15 }} />
                          <div className="h-2 rounded-full overflow-hidden -mt-2">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[8px] text-slate-300">0%</span>
                            <span className="text-[8px] font-bold" style={{ color: barColor }}>{pct.toFixed(1)}% comprobado</span>
                            <span className="text-[8px] text-slate-300">100%</span>
                          </div>
                        </div>
                      )}

                      {/* Breakdown por sección · peor → mejor */}
                      {breakdown.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Por sección</p>
                            <span className="text-[9px] text-slate-400">peor → mejor</span>
                          </div>
                          <div className="space-y-2">
                            {breakdown.map(row => {
                              const rc = semColor(row.pct);
                              return (
                                <button key={row.key} className="w-full text-left"
                                  onClick={() => setSeccionMapa(String(row.key))}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-semibold text-slate-700">{row.label}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-slate-400 tabular-nums">{fmt(row.comprobadas)}/{fmt(row.entregadas_sp)}</span>
                                      <span className="text-[9px] font-bold tabular-nums min-w-[2rem] text-right" style={{ color: rc }}>{row.pct.toFixed(0)}%</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: rc }} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ── Capa activa: Mercado Solidario ───────────────────────── */}
                {electoralMode === 'semaforo_mercado' && (() => {
                  const secKeys = Object.keys(mercadoBySec).map(Number).sort((a, b) => a - b);

                  if (!secKeys.length) return (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                      <p className="text-xs text-slate-400">Sin datos de Mercado Solidario para este sector.</p>
                    </div>
                  );

                  const drColor = (r) => r >= 100 ? '#16A34A' : r >= 75 ? '#65A30D' : r >= 50 ? '#CA8A04' : r >= 25 ? '#EA580C' : '#DC2626';
                  const drBg    = (r) => r >= 100 ? 'bg-emerald-50' : r >= 75 ? 'bg-lime-50' : r >= 50 ? 'bg-amber-50' : r >= 25 ? 'bg-orange-50' : 'bg-red-50';
                  const drTxt   = (r) => r >= 100 ? 'text-emerald-700' : r >= 75 ? 'text-lime-700' : r >= 50 ? 'text-amber-700' : r >= 25 ? 'text-orange-700' : 'text-red-700';

                  /* ── Vista: sección seleccionada ─────────────────────────── */
                  if (seccionMapa) {
                    const sec = Number(seccionMapa);
                    const d   = mercadoBySec[sec];
                    if (!d) return null;
                    const dr  = d.deliveryRate;
                    const col = drColor(dr);
                    const entregadas = d.estatusCounts['ENTREGADO'] ?? 0;
                    const pendientes = d.estatusCounts['PENDIENTE'] ?? 0;
                    const otrosCount = d.rows.length - entregadas - pendientes;

                    return (
                      <>
                        {/* Cabecera sección */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Mercado Solidario</p>
                              <p className="text-xs font-bold text-slate-800">Sección {sec}</p>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: col }}>
                              {dr.toFixed(0)}% entregado
                            </span>
                          </div>
                          <button onClick={() => setSeccionMapa('')}
                            className="mt-1.5 text-[9px] font-bold flex items-center gap-1 transition-colors"
                            style={{ color: BRAND }}>
                            ← Ver todo el sector
                          </button>
                        </div>

                        {/* Barra grande de entrega */}
                        <div className={`${drBg(dr)} rounded-xl px-3 py-3`}>
                          <div className="flex items-end justify-between mb-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Tasa de entrega</p>
                              <p className={`text-2xl font-black tabular-nums leading-none ${drTxt(dr)}`}>{dr.toFixed(1)}%</p>
                            </div>
                            <p className="text-[10px] text-slate-500 tabular-nums text-right">
                              <span className="font-bold text-slate-700">{fmt(d.totalEntregadas)}</span> de {fmt(d.totalPiezas)} pzas
                            </p>
                          </div>
                          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dr}%`, backgroundColor: col }} />
                          </div>
                        </div>

                        {/* Desglose de estatus */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 leading-none mb-1">Entregado</p>
                            <p className="text-base font-black text-emerald-700 tabular-nums">{entregadas}</p>
                            <p className="text-[8px] text-emerald-500 mt-0.5">registros</p>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1">Pendiente</p>
                            <p className="text-base font-black text-amber-700 tabular-nums">{pendientes}</p>
                            <p className="text-[8px] text-amber-500 mt-0.5">registros</p>
                          </div>
                        </div>
                        {otrosCount > 0 && (
                          <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center justify-between">
                            <p className="text-[9px] text-slate-500 font-semibold">Otros estatus</p>
                            <span className="text-[9px] font-bold text-slate-600 tabular-nums">{otrosCount} registros</span>
                          </div>
                        )}

                        {/* Registros individuales */}
                        {d.rows.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Registros</p>
                            {d.rows.map((r, i) => {
                              const est = (r.estatus ?? 'PENDIENTE').toUpperCase();
                              const isDone = est === 'ENTREGADO';
                              const piezas = Number(r.piezas ?? 0);
                              const entregadasR = Number(r.entregadas ?? 0);
                              const rRate = piezas > 0 ? Math.min((entregadasR / piezas) * 100, 100) : 0;
                              return (
                                <div key={i} className="rounded-lg bg-slate-50 px-2.5 py-2 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-semibold text-slate-700 truncate">{r.nombre ?? `Entrega ${r.entrega ?? i + 1}`}</p>
                                    <p className="text-[8px] text-slate-400 tabular-nums">
                                      {r.mes && r.año ? `${r.mes}/${r.año} · ` : ''}{entregadasR}/{piezas} pzas
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {est}
                                    </span>
                                    <span className="text-[9px] font-bold tabular-nums" style={{ color: drColor(rRate) }}>{rRate.toFixed(0)}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  }

                  /* ── Vista: sector completo ──────────────────────────────── */
                  const totalEntregadas = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalEntregadas ?? 0), 0);
                  const totalPiezas     = secKeys.reduce((s, k) => s + (mercadoBySec[k]?.totalPiezas ?? 0), 0);
                  const globalRate      = totalPiezas > 0 ? Math.min((totalEntregadas / totalPiezas) * 100, 100) : 0;
                  const completadas     = secKeys.filter(k => (mercadoBySec[k]?.deliveryRate ?? 0) >= 100).length;
                  const enProgreso      = secKeys.filter(k => { const r = mercadoBySec[k]?.deliveryRate ?? 0; return r > 0 && r < 100; }).length;
                  const sinIniciar      = secKeys.filter(k => (mercadoBySec[k]?.deliveryRate ?? 0) === 0).length;
                  const col             = drColor(globalRate);

                  const sortedSecs = [...secKeys].sort((a, b) => (mercadoBySec[a]?.deliveryRate ?? 0) - (mercadoBySec[b]?.deliveryRate ?? 0));

                  return (
                    <>
                      {/* Cabecera */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Mercado Solidario</p>
                            <p className="text-xs font-bold text-slate-800">Sector {user.poligono}</p>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: col }}>
                            {globalRate.toFixed(0)}% global
                          </span>
                        </div>
                      </div>

                      {/* Barra global */}
                      <div className={`${drBg(globalRate)} rounded-xl px-3 py-3`}>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Tasa de entrega global</p>
                            <p className={`text-3xl font-black tabular-nums leading-none ${drTxt(globalRate)}`}>{globalRate.toFixed(1)}%</p>
                          </div>
                          <p className="text-[10px] text-slate-500 tabular-nums text-right">
                            <span className="font-bold text-slate-700">{fmt(totalEntregadas)}</span><br />de {fmt(totalPiezas)} pzas
                          </p>
                        </div>
                        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${globalRate}%`, backgroundColor: col }} />
                        </div>
                      </div>

                      {/* KPIs de avance */}
                      <div className="grid grid-cols-3 gap-1">
                        <div className="bg-emerald-50 rounded-xl p-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 leading-none mb-1">Completas</p>
                          <p className="text-sm font-black text-emerald-700 tabular-nums">{completadas}</p>
                          <p className="text-[8px] text-emerald-400">secc.</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-amber-500 leading-none mb-1">En proceso</p>
                          <p className="text-sm font-black text-amber-700 tabular-nums">{enProgreso}</p>
                          <p className="text-[8px] text-amber-400">secc.</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Sin iniciar</p>
                          <p className="text-sm font-black text-slate-600 tabular-nums">{sinIniciar}</p>
                          <p className="text-[8px] text-slate-400">secc.</p>
                        </div>
                      </div>

                      {/* Por sección — ordenado de menor a mayor avance */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Por sección</p>
                          <span className="text-[8px] text-slate-400">menor avance primero</span>
                        </div>
                        {sortedSecs.map(sec => {
                          const d  = mercadoBySec[sec];
                          if (!d) return null;
                          const dr  = d.deliveryRate;
                          const col = drColor(dr);
                          return (
                            <button key={sec} className="w-full text-left"
                              onClick={() => setSeccionMapa(String(sec))}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-semibold text-slate-700">Sección {sec}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] text-slate-400 tabular-nums">{fmt(d.totalEntregadas)}/{fmt(d.totalPiezas)} pzas</span>
                                  <span className="text-[9px] font-black tabular-nums" style={{ color: col }}>{dr.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dr}%`, backgroundColor: col }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* ── Capa activa: Resultados electorales ─────────────────── */}
                {electoralMode && electoralMode !== 'semaforo_cred' && electoralMode !== 'semaforo_mercado' && electoralMode !== 'semaforo_mov' && (() => {
                  if (!electoralStats) return (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                        <p className="text-xs text-slate-400">Cargando datos electorales…</p>
                      </div>
                    </div>
                  );

                  const { totals, grandTotal, winner, secGanadas, secciones, sorted, marginVotos, marginPct,
                          isIEEM, is2024IEEM, isSenado, isDip2024,
                          morena_solo_total, pt_solo_total, naem_solo_total,
                          rosi_vs_aaron_total, mg_vs_fuerza_total, votos_nulos_total,
                          groupLevel, senadoBreakdown } = electoralStats;

                  const scopeLabel    = seccionMapa ? `Sección ${seccionMapa}` : `Sector ${user.poligono}`;
                  const marielaGanadas  = secGanadas['MARIELA'] || 0;
                  const marielaPerdidas = Math.max(0, secciones - marielaGanadas);
                  const senadoInsight   = isSenado ? buildSenadoInsight(senadoBreakdown, groupLevel, scopeLabel) : null;
                  const drillInto = (unit) => { setSeccionMapa(String(unit.key)); };
                  const candTable    = isSenado ? CANDIDATOS_SENADO : isDip2024 ? CANDIDATOS_DIP : is2024IEEM ? CANDIDATOS_2024 : CANDIDATOS_2021;
                  const winnerCand   = candTable[winner];
                  const winnerColor  = isSenado   ? (CANDIDATOS_SENADO[winner]?.fill ?? '#6B7280')
                                     : isDip2024  ? (CANDIDATOS_DIP[winner]?.fill    ?? '#6B7280')
                                     : is2024IEEM ? (CANDIDATOS_2024[winner]?.fill   ?? '#6B7280')
                                     : (PARTY_FILL[winner] ?? '#6B7280');
                  const totalSec = Object.values(secGanadas).reduce((s, n) => s + n, 0);

                  return (
                    <div className="space-y-2.5">

                      {/* Cabecera del proceso */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Proceso electoral</p>
                            <p className="text-xs font-bold text-slate-800 leading-snug">
                              {isDip2024  ? 'Diputación Local 2024 - Interno · Tecámac'
                               : isSenado ? 'Senaduría 2024 · Tecámac'
                               : is2024IEEM ? 'Ayuntamiento Tecámac · 2024'
                               : 'Ayuntamiento Tecámac · 2021'}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white ${
                            isDip2024 ? 'bg-slate-700' : is2024IEEM ? 'bg-emerald-700' : isSenado ? 'bg-rose-900' : isIEEM ? 'bg-emerald-700' : 'bg-slate-700'
                          }`}>
                            {isDip2024 ? 'Interno' : is2024IEEM ? 'IEEM oficial' : isSenado ? 'Senaduría 2024' : isIEEM ? 'IEEM oficial' : 'Datos internos'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                          {scopeLabel} · {secciones} secciones
                        </p>
                        {seccionMapa && (
                          <button onClick={() => setSeccionMapa('')}
                            className="mt-1 text-[9px] font-bold transition-colors"
                            style={{ color: BRAND }}>
                            ← Ver todo el sector
                          </button>
                        )}
                      </div>

                      {/* Ganador */}
                      <div className="rounded-xl p-3 border-2" style={{ backgroundColor: winnerColor + '15', borderColor: winnerColor + '50' }}>
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: winnerColor }}>
                            {winnerCand?.nombre?.split(' ').slice(0,2).map(w => w[0]).join('') ?? winner?.[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: winnerColor }}>
                                🏆 {winnerCand?.resultado ?? 'GANADOR'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 leading-snug">{winnerCand?.nombre ?? winner}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{winnerCand?.partido ?? winner}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Votos</p>
                            <p className="text-base font-bold tabular-nums leading-none" style={{ color: winnerColor }}>{fmt(totals[winner])}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Porcentaje</p>
                            <p className="text-base font-bold tabular-nums leading-none" style={{ color: winnerColor }}>{pct(totals[winner], grandTotal)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Ventaja</p>
                            <p className="text-base font-bold tabular-nums leading-none text-slate-700">+{marginPct}%</p>
                          </div>
                        </div>
                      </div>

                      {/* Rosi vs Aaron (2024) */}
                      {is2024IEEM && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <SectionTitle>Rosa Yolanda Wong vs Aaron Urbina</SectionTitle>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_2024.ROSI.fill }}>Rosi Wong</p>
                              <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_2024.ROSI.fill }}>{fmt(totals['ROSI'])}</p>
                              <p className="text-[10px] text-slate-400">{pct(totals['ROSI'], grandTotal)}</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <span className="text-sm font-black tabular-nums text-slate-700">{rosi_vs_aaron_total >= 0 ? '+' : ''}{fmt(rosi_vs_aaron_total)}</span>
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider">diferencia</span>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_2024.AARON.fill }}>Aaron Urbina</p>
                              <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_2024.AARON.fill }}>{fmt(totals['AARON'])}</p>
                              <p className="text-[10px] text-slate-400">{pct(totals['AARON'], grandTotal)}</p>
                            </div>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full rounded-l-full transition-all duration-700" style={{ width: pct(totals['ROSI'], grandTotal), backgroundColor: CANDIDATOS_2024.ROSI.fill }} />
                            <div className="h-full rounded-r-full transition-all duration-700" style={{ width: pct(totals['AARON'], grandTotal), backgroundColor: CANDIDATOS_2024.AARON.fill }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px]" style={{ color: CANDIDATOS_2024.ROSI.fill }}>{pct(totals['ROSI'], grandTotal)} Rosi</span>
                            <span className="text-[9px]" style={{ color: CANDIDATOS_2024.AARON.fill }}>Aaron {pct(totals['AARON'], grandTotal)}</span>
                          </div>
                        </div>
                      )}

                      {/* MG vs Fuerza (senado) */}
                      {isSenado && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <SectionTitle>Mariela Gutiérrez vs Fuerza x México</SectionTitle>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>Mariela G.</p>
                              <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>{fmt(totals['MARIELA'])}</p>
                              <p className="text-[10px] text-slate-400">{pct(totals['MARIELA'], grandTotal)}</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <span className="text-sm font-black tabular-nums text-slate-700">{mg_vs_fuerza_total >= 0 ? '+' : ''}{fmt(mg_vs_fuerza_total)}</span>
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider">diferencia</span>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>Fuerza x Méx.</p>
                              <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>{fmt(totals['FUERZA'])}</p>
                              <p className="text-[10px] text-slate-400">{pct(totals['FUERZA'], grandTotal)}</p>
                            </div>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full rounded-l-full transition-all duration-700" style={{ width: pct(totals['MARIELA'], grandTotal), backgroundColor: CANDIDATOS_SENADO.MARIELA.fill }} />
                            <div className="h-full rounded-r-full transition-all duration-700" style={{ width: pct(totals['FUERZA'], grandTotal), backgroundColor: CANDIDATOS_SENADO.FUERZA.fill }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px]" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>{pct(totals['MARIELA'], grandTotal)} Mariela</span>
                            <span className="text-[9px]" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>Fuerza {pct(totals['FUERZA'], grandTotal)}</span>
                          </div>
                          {votos_nulos_total > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-[9px] text-slate-400 uppercase tracking-widest">Votos nulos</span>
                              <span className="text-[11px] font-bold tabular-nums text-slate-500">{fmt(votos_nulos_total)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Secciones ganadas vs perdidas (senado) */}
                      {isSenado && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <SectionTitle accent="bg-rose-900">Secciones ganadas vs perdidas · Mariela</SectionTitle>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 leading-none mb-1">Ganadas</p>
                              <p className="text-xl font-bold tabular-nums text-emerald-700">{marielaGanadas}</p>
                              <p className="text-[9px] text-emerald-400 mt-0.5">{pct(marielaGanadas, secciones)}</p>
                            </div>
                            <div className="rounded-lg bg-rose-50 border border-rose-100 p-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500 leading-none mb-1">Perdidas</p>
                              <p className="text-xl font-bold tabular-nums text-rose-700">{marielaPerdidas}</p>
                              <p className="text-[9px] text-rose-400 mt-0.5">{pct(marielaPerdidas, secciones)}</p>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: pct(marielaGanadas, secciones) ?? '0%' }} />
                            <div className="h-full bg-rose-400 transition-all duration-700" style={{ width: pct(marielaPerdidas, secciones) ?? '0%' }} />
                          </div>
                        </div>
                      )}

                      {/* Análisis político dinámico (senado) */}
                      {isSenado && senadoInsight && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5">
                          <SectionTitle accent="bg-rose-900">Lectura política</SectionTitle>
                          <p className="text-[10.5px] text-rose-900/80 leading-relaxed">{senadoInsight}</p>
                        </div>
                      )}

                      {/* Desglose por sección (senado) */}
                      {isSenado && senadoBreakdown && senadoBreakdown.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <SectionTitle accent="bg-rose-900">Desglose por sección · Mariela vs Fuerza</SectionTitle>
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {senadoBreakdown.map(unit => (
                              <button key={unit.key} onClick={() => drillInto(unit)} className="w-full text-left group">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-rose-800 transition-colors flex items-center gap-1.5">
                                    {unit.label}
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${unit.won ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {unit.won ? 'GANA' : 'PIERDE'}
                                    </span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 tabular-nums">
                                    {unit.margin >= 0 ? '+' : ''}{unit.margin.toFixed(1)} pts
                                  </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                  <div className="h-full bg-[#6B0B20] transition-all duration-500" style={{ width: `${unit.marielaPct}%` }} />
                                  <div className="h-full bg-[#1460A8] transition-all duration-500" style={{ width: `${unit.fuerzaPct}%` }} />
                                </div>
                                <div className="flex justify-between mt-0.5">
                                  <span className="text-[9px] text-slate-400">{unit.secciones} sec. · {fmt(unit.total)} votos</span>
                                  <span className="text-[9px] text-slate-400">{unit.marielaPct.toFixed(0)}% / {unit.fuerzaPct.toFixed(0)}%</span>
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400">
                            Ordenado de mayor a menor ventaja de Mariela · toca una fila para ver su detalle.
                          </p>
                        </div>
                      )}

                      {/* Distribución de votos */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <SectionTitle>Distribución de votos</SectionTitle>
                        <div className="space-y-2">
                          {sorted.filter(([, v]) => v > 0).map(([party, votes]) => {
                            const cand = candTable[party];
                            const fill = isSenado ? (CANDIDATOS_SENADO[party]?.fill ?? '#6B7280') : isDip2024 ? (CANDIDATOS_DIP[party]?.fill ?? '#6B7280') : is2024IEEM ? (CANDIDATOS_2024[party]?.fill ?? '#6B7280') : (PARTY_FILL[party] ?? '#6B7280');
                            return (
                              <div key={party}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: fill }} />
                                    <span className="text-[11px] font-bold text-slate-700 flex-shrink-0">{cand?.nombre ?? party}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className="text-[10px] text-slate-400 tabular-nums">{pct(votes, grandTotal)}</span>
                                    <span className="text-[11px] font-bold tabular-nums text-slate-700 w-14 text-right">{fmt(votes)}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: pct(votes, grandTotal), backgroundColor: fill }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest">Total votos</span>
                          <span className="text-[11px] font-bold tabular-nums text-slate-700">{fmt(grandTotal)}</span>
                        </div>
                      </div>

                      {/* Coalición MORENA (IEEM) */}
                      {isIEEM && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <SectionTitle>Coalición MORENA · PT · NAEM</SectionTitle>
                          <div className="space-y-1.5">
                            {[
                              { label: 'MORENA', value: morena_solo_total, color: PARTY_FILL.MORENA },
                              { label: 'PT',     value: pt_solo_total,     color: PARTY_FILL.PT },
                              { label: 'NAEM',   value: naem_solo_total,   color: '#F97316' },
                            ].filter(r => r.value > 0).map(r => (
                              <div key={r.label}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                                    <span className="text-[11px] font-bold text-slate-700">{r.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 tabular-nums">{pct(r.value, totals['MORENA'])}</span>
                                    <span className="text-[11px] font-bold tabular-nums text-slate-700 w-14 text-right">{fmt(r.value)}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: pct(r.value, totals['MORENA']), backgroundColor: r.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Secciones ganadas (todas las elecciones) */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <SectionTitle>Mapa político · Secciones ganadas</SectionTitle>
                        <div className="space-y-1.5">
                          {Object.entries(secGanadas).sort((a, b) => b[1] - a[1]).map(([party, count]) => {
                            const fill  = isSenado ? (CANDIDATOS_SENADO[party]?.fill ?? '#6B7280') : isDip2024 ? (CANDIDATOS_DIP[party]?.fill ?? '#6B7280') : is2024IEEM ? (CANDIDATOS_2024[party]?.fill ?? '#6B7280') : (PARTY_FILL[party] ?? '#6B7280');
                            const label = isSenado ? (CANDIDATOS_SENADO[party]?.nombre ?? party) : isDip2024 ? (CANDIDATOS_DIP[party]?.nombre ?? party) : is2024IEEM ? (CANDIDATOS_2024[party]?.nombre ?? party) : party;
                            return (
                              <div key={party} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: fill }} />
                                <span className="text-[11px] font-semibold text-slate-600 flex-1 truncate">{label}</span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${(count / totalSec) * 100}%`, backgroundColor: fill }} />
                                </div>
                                <span className="text-[11px] font-bold tabular-nums text-slate-700 w-6 text-right">{count}</span>
                                <span className="text-[9px] text-slate-400 w-10 text-right">{pct(count, totalSec)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {(!electoralMode || electoralMode === 'semaforo_mov') && !seccionMapa && (() => {

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
                                { label: 'Lista Nominal', value: fmt(totalNominal),          sub: null,              accent: true },
                                { label: 'Padrón',        value: fmt(totalPadron),            sub: 'electoral' },
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
                                <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(afSector.afiliados)}</p>
                              </div>
                              <div className="bg-teal-50 rounded-lg p-2 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Comprobadas</p>
                                <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(afSector.credenciales_entregadas)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entrega</span>
                              <span className="text-[10px] font-bold text-teal-700">{pct(afSector.credenciales_entregadas, afSector.afiliados)}</span>
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
                            <span className="text-xs font-bold tabular-nums text-blue-600">{fmt(totalNominal)}</span>
                          </div>
                          <div className="mt-1.5 pt-2 border-t border-slate-100">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                              {totalHombres > 0 && <div className="h-full bg-blue-400 transition-all" style={{ width: `${((totalHombres / totalNominal) * 100).toFixed(1)}%` }} />}
                              {totalMujeres > 0 && <div className="h-full bg-rose-400 transition-all" style={{ width: `${((totalMujeres / totalNominal) * 100).toFixed(1)}%` }} />}
                            </div>
                            <div className="flex justify-between mt-1 flex-wrap gap-1">
                              {totalHombres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block" />♂ {fmt(totalHombres)}</span>}
                              {totalMujeres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-400 inline-block" />♀ {fmt(totalMujeres)}</span>}
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

                {(!electoralMode || electoralMode === 'semaforo_mov') && seccionMapa && (() => {
                  const secSelData  = seccionesSector.find(s => s.seccion === Number(seccionMapa));
                  // detalleSec built from fresh Supabase fetch (same as TableroBoard)
                  const smPorUbt    = Object.fromEntries(smsDeSec.map(p => [p.ubt, p]));
                  const detalleSec  = fraccionesDeSec.map(f => ({ fraccion: f.fraccion, seccion: Number(seccionMapa), sm: smPorUbt[f.fraccion] ?? null }));
                  const smConUbic   = smsDeSec.filter(p => p.latitud && Number(p.latitud) !== 0 && !isNaN(Number(p.latitud))).length;
                  const fracConSM   = detalleSec.filter(f => f.sm != null).length;
                  const padronTotal = secSelData?.padron ?? secSelData?.padron_electoral;
                  const afSec       = AFILIACION.find(r => r.seccion === Number(seccionMapa));

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
                              { label: 'Lista Nominal', value: fmt(secSelData?.lista_nominal), sub: null, accent: true },
                              { label: 'Padrón',        value: fmt(padronTotal),               sub: 'electoral' },
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
                                    <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(afSec.afiliados)}</p>
                                  </div>
                                  <div className="bg-teal-50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 leading-none mb-1">Comprobadas</p>
                                    <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(afSec.credenciales_entregadas)}</p>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entrega</span>
                                  <span className="text-[10px] font-bold text-teal-700">{pct(afSec.credenciales_entregadas, afSec.afiliados)}</span>
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
                                <span className="text-xs font-bold tabular-nums text-blue-600">{fmt(secSelData.lista_nominal)}</span>
                              </div>
                              <div className="mt-1.5 pt-2 border-t border-slate-100">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                                  {secSelData.hombres > 0 && <div className="h-full bg-blue-400 transition-all" style={{ width: `${((secSelData.hombres / secSelData.lista_nominal) * 100).toFixed(1)}%` }} />}
                                  {secSelData.mujeres > 0 && <div className="h-full bg-rose-400 transition-all" style={{ width: `${((secSelData.mujeres / secSelData.lista_nominal) * 100).toFixed(1)}%` }} />}
                                </div>
                                <div className="flex justify-between mt-1 flex-wrap gap-1">
                                  {secSelData.hombres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block" />♂ {fmt(secSelData.hombres)}</span>}
                                  {secSelData.mujeres > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-400 inline-block" />♀ {fmt(secSelData.mujeres)}</span>}
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
