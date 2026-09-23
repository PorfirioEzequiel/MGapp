import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiaArrowLeftSolid } from 'react-icons/lia';
import supabase, { supabaseStorage as supabaseAdmin } from '../supabase/client';
import * as XLSX from 'xlsx';

const META = 10;

// ── Guinda palette ─────────────────────────────────────────────────────────
const G = {
  950: '#4c0519',
  900: '#881337',
  800: '#9f1239',
  700: '#be123c',
  600: '#e11d48',
  500: '#f43f5e',
  200: '#fecdd3',
  100: '#ffe4e6',
  50:  '#fff1f2',
};

// ── Semáforo ───────────────────────────────────────────────────────────────
const SEMAFORO_SCALE = [
  { label: 'Excelente', range: '≥ 90%',  color: '#16A34A' },
  { label: 'Bien',      range: '75–89%', color: '#65A30D' },
  { label: 'Regular',   range: '50–74%', color: '#CA8A04' },
  { label: 'Bajo',      range: '25–49%', color: '#EA580C' },
  { label: 'Muy bajo',  range: '< 25%',  color: '#DC2626' },
];

function semaforoColor(pct) {
  if (pct == null || isNaN(pct)) return '#9CA3AF';
  if (pct >= 90) return '#16A34A';
  if (pct >= 75) return '#65A30D';
  if (pct >= 50) return '#CA8A04';
  if (pct >= 25) return '#EA580C';
  return '#DC2626';
}
function semaforoLabel(pct) {
  if (pct == null || isNaN(pct)) return 'Sin inicio';
  if (pct >= 90) return 'Excelente';
  if (pct >= 75) return 'Bien';
  if (pct >= 50) return 'Regular';
  if (pct >= 25) return 'Bajo';
  return 'Muy bajo';
}

// ── Helpers ────────────────────────────────────────────────────────────────
const BADGE_COLORS = [
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
];
function badgeColor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}
function initials(p) {
  return ((p?.nombre?.[0] ?? '') + (p?.a_paterno?.[0] ?? '')).toUpperCase() || '?';
}
function fullName(p) {
  if (!p) return '—';
  return [p.nombre, p.a_paterno, p.a_materno].filter(Boolean).join(' ');
}
function fmt(n) { return Number(n).toLocaleString('es-MX'); }

// ── Sub-components ─────────────────────────────────────────────────────────

function SemaforoDot({ pct, zero = false }) {
  const color = zero ? '#9CA3AF' : semaforoColor(pct);
  return <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />;
}

function MiniBar({ count, meta = META }) {
  const pct = meta > 0 ? Math.min(100, (count / meta) * 100) : 0;
  const color = count === 0 ? '#9CA3AF' : semaforoColor(pct);
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : ''}`}>
      <polyline points="3.5,2 8.5,6 3.5,10" />
    </svg>
  );
}

function SearchIcon({ guinda = false }) {
  return (
    <svg className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${guinda ? 'text-rose-300' : 'text-slate-400'}`}
      width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5.8" cy="5.8" r="4.2" />
      <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-100 rounded-full w-3/5" />
            <div className="h-2 bg-slate-100 rounded-full w-2/5" />
          </div>
          <div className="h-3 bg-slate-100 rounded-full w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: G[50], border: `1px solid ${G[100]}` }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          stroke={G[700]} strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="6" x2="10" y2="10" />
          <circle cx="10" cy="13.5" r="0.8" fill={G[700]} />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── PIN Gate ───────────────────────────────────────────────────────────────
const PIN_SECRET = '2027';

function PinGate({ onUnlock }) {
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef              = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const verify = useCallback((value) => {
    if (value === PIN_SECRET) {
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => {
        setPin('');
        setShaking(false);
        setTimeout(() => setError(false), 250);
        inputRef.current?.focus();
      }, 580);
    }
  }, [onUnlock]);

  useEffect(() => {
    if (pin.length === 4) verify(pin);
  }, [pin, verify]);

  const handleChange = (e) => {
    if (shaking) return;
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0c1a3a 50%, #0f172a 100%)' }}>

      <style>{`
        @keyframes pin-shake {
          0%,100%{ transform:translateX(0) }
          18%    { transform:translateX(-9px) }
          36%    { transform:translateX(9px) }
          54%    { transform:translateX(-6px) }
          72%    { transform:translateX(6px) }
          88%    { transform:translateX(-3px) }
        }
        @keyframes pin-pop {
          0%  { transform: scale(0.6); opacity: 0 }
          70% { transform: scale(1.15) }
          100%{ transform: scale(1);   opacity: 1 }
        }
        .pin-dot { animation: pin-pop 0.18s ease forwards; }
      `}</style>

      <div className="w-full max-w-[320px] flex flex-col items-center">
        <div className="mb-8 relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', boxShadow: '0 0 40px rgba(59,130,246,0.12)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="rgba(147,197,253,0.85)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2.5" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
              <circle cx="12" cy="16" r="1.2" fill="rgba(147,197,253,0.85)" stroke="none" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.1), 0 20px 60px rgba(59,130,246,0.1)' }} />
        </div>

        <h1 className="text-white font-bold text-2xl tracking-tight mb-1.5">Control MGS</h1>
        <p className="text-slate-400 text-sm mb-10 text-center leading-snug">
          Ingresa el PIN para continuar
        </p>

        <div
          className="flex gap-3.5 mb-3 cursor-text"
          style={{ animation: shaking ? 'pin-shake 0.56s ease' : 'none' }}
          onClick={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3].map(i => {
            const isFilled = pin.length > i;
            const isActive = pin.length === i && !shaking;
            return (
              <div key={i}
                className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center transition-all duration-200 select-none"
                style={{
                  background: isFilled
                    ? error ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.12)'
                    : isActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isFilled
                    ? error ? '1.5px solid rgba(239,68,68,0.5)' : '1.5px solid rgba(59,130,246,0.5)'
                    : isActive ? '1.5px solid rgba(59,130,246,0.6)' : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? '0 0 0 4px rgba(59,130,246,0.12)' : 'none',
                }}>
                {isFilled && (
                  <div className="pin-dot w-3 h-3 rounded-full"
                    style={{ background: error ? '#f87171' : '#60a5fa' }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="h-6 flex items-center justify-center mb-6">
          <p className="text-red-400 text-xs font-semibold tracking-wide transition-opacity duration-200"
            style={{ opacity: error ? 1 : 0 }}>
            PIN incorrecto — intenta de nuevo
          </p>
        </div>

        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={handleChange}
          className="sr-only"
          aria-label="PIN de acceso"
          autoComplete="off"
        />

        <p className="text-slate-600 text-xs text-center mt-1">
          Toca los cuadros para activar el teclado numérico
        </p>
      </div>
    </div>
  );
}

// ── Sector Analysis Panel ─────────────────────────────────────────────────
function SectorAnalysis({ tree, loading, movs, smByUsuario }) {
  const [sortBy, setSortBy] = useState('count');

  const rows = useMemo(() => {
    return Object.entries(tree)
      .map(([sk, v]) => ({
        key: sk,
        count: v.total,
        meta: v.meta,
        fracs: v.meta / META,
        secs: Object.keys(v.secciones).length,
        pct: v.meta > 0 ? (v.total / v.meta) * 100 : 0,
      }))
      .sort((a, b) => sortBy === 'count' ? b.count - a.count : b.pct - a.pct);
  }, [tree, sortBy]);

  const totalCount  = rows.reduce((s, r) => s + r.count, 0);
  const totalMeta   = rows.reduce((s, r) => s + r.meta,  0);
  const globalPct   = totalMeta > 0 ? (totalCount / totalMeta) * 100 : 0;
  const globalColor = totalCount === 0 ? '#9CA3AF' : semaforoColor(globalPct);

  const R = 36;
  const C = 2 * Math.PI * R;
  const dashFill = (Math.min(globalPct, 100) / 100) * C;

  function handleExport() {
    const exportRows = movs
      .filter(m => m.movilizador)
      .sort((a, b) => {
        const sa = smByUsuario[a.movilizador];
        const sb = smByUsuario[b.movilizador];
        const diff = (Number(sa?.poligono) || 0) - (Number(sb?.poligono) || 0);
        if (diff !== 0) return diff;
        const diffSec = (Number(sa?.seccion) || 0) - (Number(sb?.seccion) || 0);
        if (diffSec !== 0) return diffSec;
        return (Number(sa?.ubt) || 0) - (Number(sb?.ubt) || 0);
      })
      .map(m => {
        const sm = smByUsuario[m.movilizador];
        return {
          'Sector / SP': sm?.poligono ? `Sector ${sm.poligono}` : '—',
          'Sección':     sm?.seccion ?? '—',
          'Fracción':    sm?.ubt ?? '—',
          'SM':          sm ? fullName(sm) : '—',
          'MGS':         fullName(m),
          'Observaciones': m.observaciones || '',
          'Fecha de captura': m.created_at
            ? new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—',
        };
      });

    if (exportRows.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 34 }, { wch: 34 }, { wch: 40 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Control MGS');
    XLSX.writeFile(wb, `Control_MGS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100/70 shadow-sm p-4 animate-pulse space-y-3">
        <div className="h-4 bg-slate-100 rounded w-48" />
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-rose-100/70 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-rose-100/60"
        style={{ background: `linear-gradient(135deg, ${G[50]} 0%, #fff 100%)` }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] mb-0.5"
            style={{ color: G[700] }}>Resumen por sector</p>
          <p className="text-sm font-bold text-slate-800 leading-snug">Registros · Metas · %</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy('count')}
            className="text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={sortBy === 'count'
              ? { backgroundColor: G[100], color: G[800] }
              : {}}>
            <span className={sortBy !== 'count' ? 'text-slate-400 hover:text-slate-600' : ''}>
              # MGS
            </span>
          </button>
          <button
            onClick={() => setSortBy('pct')}
            className="text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={sortBy === 'pct'
              ? { backgroundColor: G[100], color: G[800] }
              : {}}>
            <span className={sortBy !== 'pct' ? 'text-slate-400 hover:text-slate-600' : ''}>
              % Avance
            </span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1.5 rounded-lg text-white active:scale-95 transition-all cursor-pointer ml-1 flex-shrink-0"
            style={{ backgroundColor: G[900] }}
            title="Descargar reporte Excel">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="1" x2="6" y2="8" />
              <polyline points="3,5.5 6,8.5 9,5.5" />
              <line x1="1" y1="11" x2="11" y2="11" />
            </svg>
            Reporte
          </button>
        </div>
      </div>

      {/* Ring chart + key metrics */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-50">
        <div className="flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Avance global ${globalPct.toFixed(1)}%`}>
            <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="9" />
            <circle cx="48" cy="48" r={R} fill="none"
              stroke={globalColor} strokeWidth="9"
              strokeDasharray={`${dashFill} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
            <text x="48" y="44" textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight="800" fill={globalColor} fontFamily="system-ui">
              {globalPct.toFixed(1)}%
            </text>
            <text x="48" y="57" textAnchor="middle" dominantBaseline="middle"
              fontSize="7.5" fill="#94a3b8" fontFamily="system-ui">
              avance
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Registrados</p>
            <p className="text-xl font-bold tabular-nums leading-none" style={{ color: globalColor }}>
              {fmt(totalCount)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Meta</p>
            <p className="text-xl font-bold tabular-nums text-slate-700 leading-none">{fmt(totalMeta)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Sectores</p>
            <p className="text-lg font-bold tabular-nums text-slate-700 leading-none">{rows.length}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">Pendientes</p>
            <p className="text-lg font-bold tabular-nums text-slate-700 leading-none">{fmt(totalMeta - totalCount)}</p>
          </div>
        </div>
      </div>

      {/* Semáforo legend */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 px-4 py-2 border-b border-slate-50 bg-slate-50/40">
        {SEMAFORO_SCALE.map(({ label, range, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-slate-500 font-medium">{label}</span>
            <span className="text-[9px] text-slate-300">{range}</span>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid items-center px-4 py-2 bg-slate-50/60 border-b border-slate-100"
        style={{ gridTemplateColumns: '3.5rem 1fr 5rem' }}>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Sector</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pl-2">Progreso</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right">MGS / Meta</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50 max-h-[380px] overflow-y-auto">
        {rows.map((row, idx) => {
          const color = row.count === 0 ? '#9CA3AF' : semaforoColor(row.pct);
          const label = row.count === 0 ? 'Sin inicio' : semaforoLabel(row.pct);
          return (
            <div key={row.key}
              className="grid items-center gap-2 px-4 py-2.5 transition-colors"
              style={{ gridTemplateColumns: '3.5rem 1fr 5rem' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = G[50]}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] text-slate-300 tabular-nums w-3">{idx + 1}.</span>
                  <span className="text-xs font-bold text-slate-800">S{row.key}</span>
                </div>
                <p className="text-[9px] text-slate-400 pl-4">{row.fracs}f · {row.secs}s</p>
              </div>
              <div className="pl-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                    {row.pct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] px-1.5 py-px rounded-full font-semibold"
                    style={{ backgroundColor: color + '18', color }}>
                    {label}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: color }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold tabular-nums text-slate-700">{fmt(row.count)}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">{fmt(row.meta)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer totals */}
      <div className="grid items-center gap-2 px-4 py-3 border-t-2 border-rose-100/60 bg-rose-50/40"
        style={{ gridTemplateColumns: '3.5rem 1fr 5rem' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: G[800] }}>Total</p>
        <div className="pl-2">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(globalPct, 100)}%`, backgroundColor: globalColor }} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tabular-nums" style={{ color: globalColor }}>{fmt(totalCount)}</p>
          <p className="text-[10px] text-slate-400 tabular-nums">{fmt(totalMeta)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ControlMGS() {
  const navigate = useNavigate();
  const [loading, setLoading]               = useState(true);
  const [catalog, setCatalog]               = useState([]);
  const [secsList, setSecsList]             = useState([]);
  const [smsList, setSmsList]               = useState([]);
  const [movs, setMovs]                     = useState([]);
  const [tab, setTab]                       = useState('lista');
  const [search, setSearch]                 = useState('');
  const [openSectors, setOpenSectors]       = useState({});
  const [openSecciones, setOpenSecciones]   = useState({});
  const [openSms, setOpenSms]               = useState({});
  const [pinVerified, setPinVerified]       = useState(false);

  useEffect(() => {
    async function load() {
      const [catRes, secRes, smRes, movRes] = await Promise.all([
        supabaseAdmin.from('ubt_catalogo').select('seccion, fraccion').order('seccion').order('fraccion', { ascending: true }),
        supabaseAdmin.from('secciones').select('seccion, pologono'),
        supabaseAdmin.from('ciudadania').select('usuario, nombre, a_paterno, a_materno, seccion, poligono, ubt').ilike('puesto', 'sm').eq('status', 'ACTIVO'),
        supabaseAdmin.from('ciudadania').select('id, usuario, nombre, a_paterno, a_materno, curp, telefono_1, movilizador, observaciones, created_at').ilike('puesto', 'movilizador').eq('status', 'ACTIVO').order('a_paterno'),
      ]);
      setCatalog(catRes.data ?? []);
      setSecsList(secRes.data ?? []);
      setSmsList(smRes.data ?? []);
      setMovs(movRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Derived maps ──────────────────────────────────────────────────────────
  const secToSector = useMemo(() => {
    const m = {};
    secsList.forEach(s => { m[s.seccion] = s.pologono; });
    return m;
  }, [secsList]);

  const smByUbt = useMemo(() => {
    const m = {};
    smsList.forEach(sm => { if (sm.ubt != null) m[String(sm.ubt)] = sm; });
    return m;
  }, [smsList]);

  const smByUsuario = useMemo(() => {
    const m = {};
    smsList.forEach(sm => { m[sm.usuario] = sm; });
    return m;
  }, [smsList]);

  const movsBySmUsuario = useMemo(() => {
    const m = {};
    movs.forEach(mov => {
      if (mov.movilizador) {
        if (!m[mov.movilizador]) m[mov.movilizador] = [];
        m[mov.movilizador].push(mov);
      }
    });
    return m;
  }, [movs]);

  // ── Complete catalog tree ─────────────────────────────────────────────────
  const tree = useMemo(() => {
    const sectors = {};
    catalog.forEach(({ seccion, fraccion }) => {
      const sector  = secToSector[seccion] ?? '?';
      const sm      = smByUbt[String(fraccion)] ?? null;
      const fracMovs = sm ? (movsBySmUsuario[sm.usuario] ?? []) : [];
      const count   = fracMovs.length;

      if (!sectors[sector]) sectors[sector] = { total: 0, meta: 0, secciones: {} };
      sectors[sector].total += count;
      sectors[sector].meta  += META;

      const secs = sectors[sector].secciones;
      if (!secs[seccion]) secs[seccion] = { total: 0, meta: 0, fracciones: {} };
      secs[seccion].total += count;
      secs[seccion].meta  += META;
      secs[seccion].fracciones[fraccion] = { fraccion, sm, movs: fracMovs, count };
    });
    return sectors;
  }, [catalog, secToSector, smByUbt, movsBySmUsuario]);

  // ── Global stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalMeta  = catalog.length * META;
    const totalMovs  = movs.length;
    const pct        = totalMeta > 0 ? (totalMovs / totalMeta) * 100 : null;
    let fracsOK = 0;
    let smsConMovs = 0;
    smsList.forEach(sm => {
      if ((movsBySmUsuario[sm.usuario] ?? []).length > 0) smsConMovs++;
    });
    Object.values(tree).forEach(sector =>
      Object.values(sector.secciones).forEach(sec =>
        Object.values(sec.fracciones).forEach(f => { if (f.count >= META) fracsOK++; })
      )
    );
    return { totalMovs, totalMeta, totalFracs: catalog.length, fracsOK, totalSMs: smsList.length, smsConMovs, pct };
  }, [catalog, movs, smsList, movsBySmUsuario, tree]);

  // ── Search filters ────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredMovs = useMemo(() => {
    if (!q) return movs;
    return movs.filter(m => {
      const sm = smByUsuario[m.movilizador];
      return fullName(m).toLowerCase().includes(q) ||
        (m.curp || '').toLowerCase().includes(q) ||
        fullName(sm).toLowerCase().includes(q) ||
        String(sm?.seccion ?? '').includes(q) ||
        String(sm?.poligono ?? '').includes(q);
    });
  }, [movs, q, smByUsuario]);

  const sectorKeys = useMemo(() =>
    Object.keys(tree)
      .filter(sk => {
        if (!q) return true;
        if (String(sk).includes(q)) return true;
        return Object.keys(tree[sk].secciones).some(secK =>
          String(secK).includes(q) ||
          Object.keys(tree[sk].secciones[secK].fracciones).some(fK => String(fK).includes(q))
        );
      })
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
  [tree, q]);

  const filteredSMs = useMemo(() =>
    smsList
      .filter(sm => {
        if (!q) return true;
        return fullName(sm).toLowerCase().includes(q) ||
          String(sm.seccion ?? '').includes(q) ||
          String(sm.poligono ?? '').includes(q);
      })
      .sort((a, b) => {
        const ca = (movsBySmUsuario[a.usuario] ?? []).length;
        const cb = (movsBySmUsuario[b.usuario] ?? []).length;
        return cb - ca;
      }),
  [smsList, q, movsBySmUsuario]);

  const toggleSector  = k => setOpenSectors(p => ({ ...p, [k]: !p[k] }));
  const toggleSeccion = k => setOpenSecciones(p => ({ ...p, [k]: !p[k] }));
  const toggleSm      = k => setOpenSms(p => ({ ...p, [k]: !p[k] }));

  const TABS = [
    { key: 'lista',  label: 'Lista MGS' },
    { key: 'sector', label: 'Por Sector' },
    { key: 'sm',     label: 'Por SM' },
  ];

  const globalColor = stats.totalMovs === 0 ? '#9CA3AF' : semaforoColor(stats.pct);
  const globalLabel = stats.totalMovs === 0 ? 'Sin inicio' : semaforoLabel(stats.pct);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!pinVerified) return <PinGate onUnlock={() => setPinVerified(true)} />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fdf8f9' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="px-5 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-20"
        style={{ background: `linear-gradient(135deg, ${G[950]} 0%, ${G[900]} 60%, ${G[800]} 100%)` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          aria-label="Regresar">
          <LiaArrowLeftSolid size={20} color="rgba(255,255,255,0.8)" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight tracking-tight">Control MGS</h1>
          <p className="text-xs mt-px" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Desdoble de movilizadores de gestión
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {stats.pct != null && (
            <span className="text-sm font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {stats.pct.toFixed(1)}%
            </span>
          )}
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: `${globalColor}22`,
              border: `1px solid ${globalColor}50`,
              color: globalColor,
            }}>
            {globalLabel}
          </span>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-4 lg:px-8">

        {/* ── KPI Strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-5">

          {/* MGS Registrados — guinda hero */}
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${G[900]} 0%, ${G[700]} 100%)` }}>
            <div className="absolute right-3 top-3 opacity-10">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white" stroke="none">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.6)' }}>MGS Registrados</p>
            <p className="text-3xl font-bold tabular-nums text-white leading-none">
              {loading ? '—' : fmt(stats.totalMovs)}
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              de {loading ? '—' : fmt(stats.totalMeta)} meta
            </p>
            {!loading && stats.pct != null && (
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(stats.pct, 100)}%`, backgroundColor: 'rgba(255,255,255,0.7)' }} />
              </div>
            )}
          </div>

          {/* Fracciones con MGS */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md"
            style={{ borderColor: G[100] }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Fracciones con MGS
            </p>
            <div className="flex items-end gap-1">
              <p className="text-3xl font-bold tabular-nums leading-none"
                style={{ color: stats.fracsOK > 0 ? G[900] : '#1e293b' }}>
                {loading ? '—' : stats.fracsOK}
              </p>
              <p className="text-xl text-slate-300 mb-0.5 tabular-nums leading-none">
                /{loading ? '—' : stats.totalFracs}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">en meta (10/10)</p>
          </div>

          {/* SMs con movilizadoras */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md"
            style={{ borderColor: G[100] }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              SMs con movilizadoras
            </p>
            <div className="flex items-end gap-1">
              <p className="text-3xl font-bold tabular-nums leading-none"
                style={{ color: stats.smsConMovs > 0 ? '#0369A1' : '#1e293b' }}>
                {loading ? '—' : stats.smsConMovs}
              </p>
              <p className="text-xl text-slate-300 mb-0.5 tabular-nums leading-none">
                /{loading ? '—' : stats.totalSMs}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">con ≥ 1 MGS asignada</p>
          </div>

          {/* Avance global */}
          <div className="bg-white rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md"
            style={{ borderColor: G[100] }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Avance global
            </p>
            <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: globalColor }}>
              {loading ? '—' : stats.pct != null ? `${stats.pct.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs font-semibold mt-2" style={{ color: globalColor }}>{globalLabel}</p>
            {!loading && stats.pct != null && (
              <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(stats.pct, 100)}%`, backgroundColor: globalColor }} />
              </div>
            )}
          </div>
        </div>

        {/* ── Main content: sidebar + panel ─────────────────────────────── */}
        <div className="lg:flex gap-5 items-start pb-16">

          {/* Left sidebar: Sector Analysis (desktop only) */}
          <aside className="hidden lg:block w-[380px] flex-shrink-0">
            <SectorAnalysis tree={tree} loading={loading} movs={movs} smByUsuario={smByUsuario} />
          </aside>

          {/* Right: Detail panel */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"
              style={{ borderColor: `${G[100]}` }}>

              {/* Tab nav */}
              <div className="flex" style={{ borderBottom: `1px solid ${G[100]}` }}>
                {TABS.map(t => (
                  <button key={t.key}
                    onClick={() => { setTab(t.key); setSearch(''); }}
                    className="flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-150 cursor-pointer select-none"
                    style={tab === t.key
                      ? {
                          color: G[800],
                          borderBottom: `2px solid ${G[800]}`,
                          marginBottom: '-1px',
                          backgroundColor: `${G[50]}`,
                        }
                      : { color: '#94a3b8' }
                    }
                    onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={e => { if (tab !== t.key) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = ''; } }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="px-4 py-3 border-b border-slate-50">
                <div className="relative">
                  <SearchIcon />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={
                      tab === 'lista'  ? 'Buscar MGS, CURP o SM asignada…' :
                      tab === 'sector' ? 'Buscar sector, sección o fracción…' :
                      'Buscar SM por nombre, sección o sector…'
                    }
                    className="w-full border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-sm focus:outline-none placeholder:text-slate-300 transition-all duration-150"
                    style={{ '--tw-ring-color': `${G[200]}` }}
                    onFocus={e => { e.target.style.borderColor = G[400] ?? G[700]; e.target.style.boxShadow = `0 0 0 3px ${G[100]}`; }}
                    onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* ── LISTA TAB ── */}
              {tab === 'lista' && (
                <div>
                  {loading ? <LoadingSkeleton /> :
                   filteredMovs.length === 0 ? (
                    <EmptyState
                      title={movs.length === 0 ? 'Sin movilizadoras registradas' : 'Sin resultados'}
                      sub={movs.length === 0
                        ? 'Usa el módulo "Movilizadores de Gestión" para agregar'
                        : `No hay coincidencias para "${search}"`}
                    />
                  ) : (
                    <>
                      {/* Result count */}
                      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {filteredMovs.length} movilizadora{filteredMovs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Desktop: data table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: G[50], borderBottom: `1px solid ${G[100]}` }}>
                              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>MGS</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>SM Asignada</th>
                              <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>Sector</th>
                              <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>Sección</th>
                              <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>Fracción</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: G[700] }}>Teléfono</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMovs.map((m, idx) => {
                              const sm = smByUsuario[m.movilizador];
                              return (
                                <tr key={m.id ?? m.usuario}
                                  className="border-b border-slate-50 transition-colors"
                                  style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = G[50]}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#fafafa'}>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(m.usuario)}`}>
                                        {initials(m)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 leading-tight truncate max-w-[180px]">
                                          {fullName(m)}
                                        </p>
                                        {m.observaciones && (
                                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]" title={m.observaciones}>
                                            {m.observaciones}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 text-sm">
                                    <p className="truncate max-w-[180px]">{fullName(sm)}</p>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {sm?.poligono
                                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                          style={{ backgroundColor: G[100], color: G[800] }}>
                                          S{sm.poligono}
                                        </span>
                                      : <span className="text-slate-300">—</span>}
                                  </td>
                                  <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-600">
                                    {sm?.seccion ?? '—'}
                                  </td>
                                  <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-600">
                                    {sm?.ubt ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">
                                    {m.telefono_1 || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: card list */}
                      <div className="md:hidden divide-y divide-slate-50">
                        {filteredMovs.map(m => {
                          const sm = smByUsuario[m.movilizador];
                          return (
                            <div key={m.id ?? m.usuario}
                              className="flex items-center gap-3 px-4 py-3.5 transition-colors"
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = G[50]}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(m.usuario)}`}>
                                {initials(m)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{fullName(m)}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{fullName(sm) || '—'}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {sm?.poligono && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: G[100], color: G[800] }}>
                                    S{sm.poligono}
                                  </span>
                                )}
                                <p className="text-[11px] text-slate-400 mt-0.5">{sm?.seccion ? `Sec. ${sm.seccion}` : '—'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── SECTOR TAB ── */}
              {tab === 'sector' && (
                <div>
                  {loading ? <LoadingSkeleton /> :
                   sectorKeys.length === 0 ? (
                    <EmptyState
                      title={catalog.length === 0 ? 'Sin catálogo de fracciones' : 'Sin resultados'}
                      sub={catalog.length === 0 ? 'El catálogo ubt_catalogo no tiene registros' : `No coincide con "${search}"`}
                    />
                  ) : sectorKeys.map(sk => {
                    const sector = tree[sk];
                    const isOpen = !!openSectors[sk];
                    const pct    = sector.meta > 0 ? (sector.total / sector.meta) * 100 : 0;
                    const color  = sector.total === 0 ? '#9CA3AF' : semaforoColor(pct);
                    return (
                      <div key={sk} className="border-b border-slate-50 last:border-0">
                        <button type="button" onClick={() => toggleSector(sk)}
                          className="w-full flex items-center gap-3 px-4 py-4 transition-colors cursor-pointer text-left"
                          style={{ backgroundColor: isOpen ? G[50] : '' }}
                          onMouseEnter={e => { if (!isOpen) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                          onMouseLeave={e => { if (!isOpen) e.currentTarget.style.backgroundColor = ''; }}>
                          <Chevron open={isOpen} />
                          <SemaforoDot pct={pct} zero={sector.total === 0} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-slate-800">Sector {sk}</span>
                            <span className="text-[11px] text-slate-400 ml-2">
                              {Object.keys(sector.secciones).length} secc. · {sector.meta / META} fracc.
                            </span>
                          </div>
                          {/* inline mini progress */}
                          <div className="hidden sm:flex items-center gap-2 w-32 flex-shrink-0">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0 min-w-[56px]">
                            <p className="text-sm font-bold tabular-nums" style={{ color }}>
                              {sector.total}/{sector.meta}
                            </p>
                          </div>
                        </button>

                        {isOpen && Object.keys(sector.secciones)
                          .sort((a, b) => Number(a) - Number(b))
                          .map(secK => {
                            const sec       = sector.secciones[secK];
                            const secOpenKey = `${sk}_${secK}`;
                            const isSecOpen  = !!openSecciones[secOpenKey];
                            const secPct     = sec.meta > 0 ? (sec.total / sec.meta) * 100 : 0;
                            const secColor   = sec.total === 0 ? '#9CA3AF' : semaforoColor(secPct);
                            return (
                              <div key={secK} className="bg-slate-50/50">
                                <button type="button" onClick={() => toggleSeccion(secOpenKey)}
                                  className="w-full flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-slate-100/50 transition-colors cursor-pointer text-left">
                                  <Chevron open={isSecOpen} />
                                  <SemaforoDot pct={secPct} zero={sec.total === 0} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-slate-700">Sección {secK}</span>
                                    <span className="text-[11px] text-slate-400 ml-2">
                                      {Object.keys(sec.fracciones).length} fracc.
                                    </span>
                                  </div>
                                  <div className="hidden sm:flex items-center gap-2 w-32 flex-shrink-0">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(secPct, 100)}%`, backgroundColor: secColor }} />
                                    </div>
                                    <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: secColor }}>
                                      {secPct.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="text-right flex-shrink-0 min-w-[56px]">
                                    <p className="text-sm font-semibold tabular-nums" style={{ color: secColor }}>
                                      {sec.total}/{sec.meta}
                                    </p>
                                  </div>
                                </button>

                                {isSecOpen && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-100/60 ml-8">
                                    {Object.keys(sec.fracciones)
                                      .sort((a, b) => Number(a) - Number(b))
                                      .map(fracK => {
                                        const frac      = sec.fracciones[fracK];
                                        const fracPct   = (frac.count / META) * 100;
                                        const fracColor = frac.count === 0 ? '#9CA3AF' : semaforoColor(fracPct);
                                        return (
                                          <div key={fracK}
                                            className="bg-white px-4 py-3 transition-colors"
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = G[50]}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                            <div className="flex items-center justify-between mb-1.5">
                                              <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold text-slate-700">
                                                  Fracc. {fracK}
                                                </span>
                                                {frac.sm
                                                  ? <p className="text-[10px] text-slate-400 truncate mt-px">{fullName(frac.sm)}</p>
                                                  : <p className="text-[10px] text-slate-300 italic mt-px">Sin SM</p>
                                                }
                                              </div>
                                              <span className="text-xs font-bold tabular-nums ml-2 flex-shrink-0"
                                                style={{ color: fracColor }}>
                                                {frac.count}/{META}
                                              </span>
                                            </div>
                                            <MiniBar count={frac.count} />
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── SM TAB ── */}
              {tab === 'sm' && (
                <div>
                  {loading ? <LoadingSkeleton /> :
                   filteredSMs.length === 0 ? (
                    <EmptyState
                      title={smsList.length === 0 ? 'Sin SMs registradas' : 'Sin resultados'}
                      sub={smsList.length === 0 ? 'No hay supervisoras de manzana activas' : `No coincide con "${search}"`}
                    />
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-slate-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {filteredSMs.length} SM{filteredSMs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
                        {filteredSMs.map(sm => {
                          const smMovs = movsBySmUsuario[sm.usuario] ?? [];
                          const count  = smMovs.length;
                          const smPct  = (count / META) * 100;
                          const color  = count === 0 ? '#9CA3AF' : semaforoColor(smPct);
                          const label  = count === 0 ? 'Sin inicio' : semaforoLabel(smPct);
                          const isOpen = !!openSms[sm.usuario];
                          return (
                            <div key={sm.usuario}
                              className="border rounded-xl overflow-hidden transition-all duration-150"
                              style={{
                                borderColor: isOpen ? G[200] : '#e2e8f0',
                                boxShadow: isOpen ? `0 0 0 2px ${G[100]}` : 'none',
                              }}>

                              {/* SM row */}
                              <button
                                type="button"
                                onClick={() => toggleSm(sm.usuario)}
                                className="w-full flex items-center gap-3 p-4 text-left transition-colors cursor-pointer"
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = G[50]}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>

                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${badgeColor(sm.usuario)}`}>
                                  {initials(sm)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-800 truncate">{fullName(sm)}</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {[
                                      sm.seccion  ? `Sec. ${sm.seccion}` : null,
                                      sm.poligono ? `S${sm.poligono}` : null,
                                      sm.ubt      ? `Fr. ${sm.ubt}` : null,
                                    ].filter(Boolean).join(' · ') || '—'}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(smPct, 100)}%`, backgroundColor: color }} />
                                    </div>
                                    <span className="text-[10px] tabular-nums font-bold"
                                      style={{ color }}>{count}/{META}</span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: color + '18', color }}>
                                    {label}
                                  </span>
                                  <Chevron open={isOpen} />
                                </div>
                              </button>

                              {/* MGS list */}
                              {isOpen && (
                                <div style={{ borderTop: `1px solid ${G[100]}`, backgroundColor: G[50] + '66' }}>
                                  {smMovs.length === 0 ? (
                                    <p className="px-4 py-3 text-xs text-slate-400 italic">
                                      Sin movilizadoras registradas
                                    </p>
                                  ) : (
                                    <div className="divide-y max-h-52 overflow-y-auto"
                                      style={{ divideColor: G[100] }}>
                                      {smMovs.map((m, idx) => (
                                        <div key={m.id ?? m.usuario}
                                          className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                                          style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.5)' }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
                                          onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.5)'}>
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${badgeColor(m.usuario)}`}>
                                            {initials(m)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-700 truncate">{fullName(m)}</p>
                                            {m.observaciones && (
                                              <p className="text-[10px] text-slate-400 truncate">{m.observaciones}</p>
                                            )}
                                          </div>
                                          {m.telefono_1 && (
                                            <p className="text-[10px] text-slate-400 tabular-nums flex-shrink-0">{m.telefono_1}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>

            {/* Mobile: Sector Analysis below panel */}
            <div className="lg:hidden mt-4">
              <SectorAnalysis tree={tree} loading={loading} movs={movs} smByUsuario={smByUsuario} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
