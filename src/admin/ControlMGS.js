import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiaArrowLeftSolid } from 'react-icons/lia';
import supabase, { supabaseStorage as supabaseAdmin } from '../supabase/client';
import * as XLSX from 'xlsx';

const META = 10;

// ── Semáforo (matches TableroBoard "Desdoble Movilizadores") ───────────────
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
  'bg-blue-100 text-blue-700',   'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',   'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
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
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />;
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
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : ''}`}>
      <polyline points="3.5,2 8.5,6 3.5,10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5.8" cy="5.8" r="4.2" />
      <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-slate-50 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-100 rounded-full w-2/3" />
            <div className="h-2.5 bg-slate-100 rounded-full w-1/3" />
          </div>
          <div className="h-3 bg-slate-100 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="6" x2="10" y2="10" />
          <circle cx="10" cy="13.5" r="0.8" fill="#94a3b8" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Sector Analysis Panel ─────────────────────────────────────────────────
function SectorAnalysis({ tree, loading }) {
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

  // SVG ring chart
  const R = 36;
  const C = 2 * Math.PI * R;
  const dashFill = (Math.min(globalPct, 100) / 100) * C;

  function handleExport() {
    const fechaLarga = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const aoa = [
      ['CONTROL MGS — Desdoble de Movilizadores de Gestión'],
      [`Generado: ${fechaLarga}`],
      [`Total registrados: ${totalCount} de ${totalMeta} meta (${globalPct.toFixed(1)}%)`],
      [],
      ['Sector / SP', 'Sección', 'Fracción', 'SM (Supervisor de Manzana)', 'MGS (Movilizadora de Gestión)', 'CURP', 'Observaciones'],
    ];

    Object.keys(tree)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(sk => {
        Object.keys(tree[sk].secciones)
          .sort((a, b) => Number(a) - Number(b))
          .forEach(secK => {
            Object.keys(tree[sk].secciones[secK].fracciones)
              .sort((a, b) => Number(a) - Number(b))
              .forEach(fracK => {
                const frac = tree[sk].secciones[secK].fracciones[fracK];
                const smNombre = frac.sm ? fullName(frac.sm) : 'Sin SM asignada';
                if (frac.movs.length === 0) {
                  aoa.push([`Sector ${sk}`, Number(secK), Number(fracK), smNombre, '—', '—', '']);
                } else {
                  frac.movs.forEach(m => {
                    aoa.push([`Sector ${sk}`, Number(secK), Number(fracK), smNombre, fullName(m), m.curp || '—', m.observaciones || '']);
                  });
                }
              });
          });
      });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 34 }, { wch: 34 }, { wch: 20 }, { wch: 40 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Control MGS');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Control_MGS_${dateStr}.xlsx`);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-pulse space-y-3">
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">
            Resumen por sector
          </p>
          <p className="text-sm font-bold text-slate-800 leading-snug">
            Registros · Metas · Porcentajes
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy('count')}
            className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              sortBy === 'count'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}>
            # Registros
          </button>
          <button
            onClick={() => setSortBy('pct')}
            className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              sortBy === 'pct'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}>
            % Avance
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer ml-1 flex-shrink-0"
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
      <div className="flex items-center gap-5 px-4 py-4 border-b border-slate-50">

        {/* Donut ring */}
        <div className="flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Avance global ${globalPct.toFixed(1)}%`}>
            {/* Track */}
            <circle cx="48" cy="48" r={R} fill="none" stroke="#f1f5f9" strokeWidth="9" />
            {/* Progress arc */}
            <circle cx="48" cy="48" r={R} fill="none"
              stroke={globalColor} strokeWidth="9"
              strokeDasharray={`${dashFill} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
            {/* Center pct */}
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

        {/* Summary metrics 2×2 */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 flex-1">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">
              Registrados
            </p>
            <p className="text-xl font-bold tabular-nums leading-none" style={{ color: globalColor }}>
              {fmt(totalCount)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">
              Meta global
            </p>
            <p className="text-xl font-bold tabular-nums text-slate-700 leading-none">
              {fmt(totalMeta)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">
              Sectores
            </p>
            <p className="text-lg font-bold tabular-nums text-slate-700 leading-none">
              {rows.length}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">
              Pendientes
            </p>
            <p className="text-lg font-bold tabular-nums text-slate-700 leading-none">
              {fmt(totalMeta - totalCount)}
            </p>
          </div>
        </div>
      </div>

      {/* Semáforo legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5 border-b border-slate-50 bg-slate-50/40">
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

      {/* Sector rows */}
      <div className="divide-y divide-slate-50">
        {rows.map((row, idx) => {
          const color = row.count === 0 ? '#9CA3AF' : semaforoColor(row.pct);
          const label = row.count === 0 ? 'Sin inicio' : semaforoLabel(row.pct);
          return (
            <div key={row.key}
              className="grid items-center gap-2 px-4 py-2.5 hover:bg-blue-50/30 transition-colors"
              style={{ gridTemplateColumns: '3.5rem 1fr 5rem' }}>

              {/* Rank + sector */}
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] text-slate-300 tabular-nums w-3">{idx + 1}.</span>
                  <span className="text-xs font-bold text-slate-800">S{row.key}</span>
                </div>
                <p className="text-[9px] text-slate-400 pl-4">{row.fracs}f · {row.secs}s</p>
              </div>

              {/* Progress bar + label */}
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
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: color }} />
                </div>
              </div>

              {/* Count / meta */}
              <div className="text-right">
                <p className="text-xs font-bold tabular-nums text-slate-700">{fmt(row.count)}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">{fmt(row.meta)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div className="grid items-center gap-2 px-4 py-3 border-t-2 border-slate-200 bg-slate-50"
        style={{ gridTemplateColumns: '3.5rem 1fr 5rem' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Total</p>
        <div className="pl-2">
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(globalPct, 100)}%`, backgroundColor: globalColor }} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tabular-nums" style={{ color: globalColor }}>
            {fmt(totalCount)}
          </p>
          <p className="text-[10px] text-slate-400 tabular-nums">{fmt(totalMeta)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ControlMGS() {
  const navigate = useNavigate();
  const [loading, setLoading]     = useState(true);
  const [catalog, setCatalog]     = useState([]);
  const [secsList, setSecsList]   = useState([]);
  const [smsList, setSmsList]     = useState([]);
  const [movs, setMovs]           = useState([]);
  const [tab, setTab]             = useState('lista');
  const [search, setSearch]       = useState('');
  const [openSectors, setOpenSectors]     = useState({});
  const [openSecciones, setOpenSecciones] = useState({});
  const [openSms, setOpenSms]             = useState({});

  useEffect(() => {
    async function load() {
      const [catRes, secRes, smRes, movRes] = await Promise.all([
        supabase
          .from('ubt_catalogo')
          .select('seccion, fraccion')
          .order('seccion')
          .order('fraccion', { ascending: true }),
        supabaseAdmin
          .from('secciones')
          .select('seccion, pologono'),
        supabase
          .from('ciudadania')
          .select('usuario, nombre, a_paterno, a_materno, seccion, poligono, ubt')
          .ilike('puesto', 'sm')
          .eq('status', 'ACTIVO'),
        supabase
          .from('ciudadania')
          .select('id, usuario, nombre, a_paterno, a_materno, curp, telefono_1, movilizador, observaciones')
          .ilike('puesto', 'movilizador')
          .eq('status', 'ACTIVO')
          .order('a_paterno'),
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

  // ── Complete catalog tree (all fracciones, even with 0 MGS) ──────────────
  const tree = useMemo(() => {
    const sectors = {};
    catalog.forEach(({ seccion, fraccion }) => {
      const sector = secToSector[seccion] ?? '?';
      const sm = smByUbt[String(fraccion)] ?? null;
      const fracMovs = sm ? (movsBySmUsuario[sm.usuario] ?? []) : [];
      const count = fracMovs.length;

      if (!sectors[sector]) sectors[sector] = { total: 0, meta: 0, secciones: {} };
      sectors[sector].total += count;
      sectors[sector].meta += META;

      const secs = sectors[sector].secciones;
      if (!secs[seccion]) secs[seccion] = { total: 0, meta: 0, fracciones: {} };
      secs[seccion].total += count;
      secs[seccion].meta += META;

      secs[seccion].fracciones[fraccion] = { fraccion, sm, movs: fracMovs, count };
    });
    return sectors;
  }, [catalog, secToSector, smByUbt, movsBySmUsuario]);

  // ── Global stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalMeta = catalog.length * META;
    const totalMovs = movs.length;
    const pct = totalMeta > 0 ? (totalMovs / totalMeta) * 100 : null;
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
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Regresar">
          <LiaArrowLeftSolid size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg leading-tight">Control MGS</h1>
          <p className="text-blue-200 text-xs mt-0.5">Desdoble de movilizadores de gestión</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: `${globalColor}22`, border: `1px solid ${globalColor}55`, color: globalColor }}>
          {globalLabel}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-4">

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className="rounded-2xl bg-blue-600 border border-blue-500 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1.5">
              MGS Registrados
            </p>
            <p className="text-2xl font-bold text-white tabular-nums leading-none">{fmt(stats.totalMovs)}</p>
            <p className="text-xs text-blue-300 mt-1.5">de {fmt(stats.totalMeta)} meta</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Fracciones con MGS
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none">
              <span style={{ color: stats.fracsOK > 0 ? '#16A34A' : '#1e293b' }}>{stats.fracsOK}</span>
              <span className="text-lg text-slate-300">/{stats.totalFracs}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1.5">en meta (10/10)</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              SMs con movilizadoras
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none">
              <span style={{ color: stats.smsConMovs > 0 ? '#0369A1' : '#1e293b' }}>{stats.smsConMovs}</span>
              <span className="text-lg text-slate-300">/{stats.totalSMs}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1.5">con movilizadoras</p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Avance global
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: globalColor }}>
              {stats.pct != null ? `${stats.pct.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs mt-1.5" style={{ color: globalColor }}>{globalLabel}</p>
          </div>
        </div>

        {/* ── Sector Analysis Panel ── */}
        <SectorAnalysis tree={tree} loading={loading} />

        {/* ── Drill-down tabs panel ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {TABS.map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key); setSearch(''); }}
                className={`flex-1 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer select-none ${
                  tab === t.key
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px bg-blue-50/40'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/60'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-50">
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={
                  tab === 'lista'  ? 'Nombre, CURP o SM asignada…' :
                  tab === 'sector' ? 'Sector, sección o fracción…' :
                  'Nombre, sección o sector de SM…'
                }
                className="w-full border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 placeholder:text-slate-300 transition-colors"
              />
            </div>
          </div>

          {/* ── LISTA TAB ── */}
          {tab === 'lista' && (
            <div>
              {loading ? <LoadingSkeleton /> :
               filteredMovs.length === 0 ? (
                <EmptyState
                  title={movs.length === 0 ? 'Sin movilizadores registrados' : 'Sin resultados'}
                  sub={movs.length === 0
                    ? 'Usa el módulo "Movilizadores de Gestión" para agregar'
                    : `No coincide con "${search}"`}
                />
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {filteredMovs.length} movilizador{filteredMovs.length !== 1 ? 'as' : 'a'}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {filteredMovs.map(m => {
                      const sm = smByUsuario[m.movilizador];
                      return (
                        <div key={m.id ?? m.usuario}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/80 transition-colors">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(m.usuario)}`}>
                            {initials(m)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{fullName(m)}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono tracking-wide truncate">{m.curp || '—'}</p>
                          </div>
                          <div className="hidden sm:block text-right flex-shrink-0 max-w-[180px]">
                            <p className="text-xs font-medium text-slate-600 truncate">{fullName(sm)}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {[sm?.seccion ? `Sec. ${sm.seccion}` : null, sm?.poligono ? `Sector ${sm.poligono}` : null]
                                .filter(Boolean).join(' · ') || '—'}
                            </p>
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
                const pct = sector.meta > 0 ? (sector.total / sector.meta) * 100 : 0;
                const color = sector.total === 0 ? '#9CA3AF' : semaforoColor(pct);
                return (
                  <div key={sk} className="border-b border-slate-50 last:border-0">
                    <button type="button" onClick={() => toggleSector(sk)}
                      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors cursor-pointer text-left">
                      <Chevron open={isOpen} />
                      <SemaforoDot pct={pct} zero={sector.total === 0} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-slate-800">Sector {sk}</span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          {Object.keys(sector.secciones).length} secc. · {sector.meta / META} fracc.
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 min-w-[64px]">
                        <p className="text-sm font-bold tabular-nums" style={{ color }}>
                          {sector.total}/{sector.meta}
                        </p>
                        <p className="text-[10px] tabular-nums" style={{ color }}>
                          {sector.meta > 0 ? `${pct.toFixed(0)}%` : '—'}
                        </p>
                      </div>
                    </button>

                    {isOpen && Object.keys(sector.secciones)
                      .sort((a, b) => Number(a) - Number(b))
                      .map(secK => {
                        const sec = sector.secciones[secK];
                        const secOpenKey = `${sk}_${secK}`;
                        const isSecOpen = !!openSecciones[secOpenKey];
                        const secPct = sec.meta > 0 ? (sec.total / sec.meta) * 100 : 0;
                        const secColor = sec.total === 0 ? '#9CA3AF' : semaforoColor(secPct);
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
                              <div className="text-right flex-shrink-0 min-w-[64px]">
                                <p className="text-sm font-semibold tabular-nums" style={{ color: secColor }}>
                                  {sec.total}/{sec.meta}
                                </p>
                                <p className="text-[10px] tabular-nums" style={{ color: secColor }}>
                                  {secPct.toFixed(0)}%
                                </p>
                              </div>
                            </button>

                            {isSecOpen && Object.keys(sec.fracciones)
                              .sort((a, b) => Number(a) - Number(b))
                              .map(fracK => {
                                const frac = sec.fracciones[fracK];
                                const fracPct = (frac.count / META) * 100;
                                const fracColor = frac.count === 0 ? '#9CA3AF' : semaforoColor(fracPct);
                                return (
                                  <div key={fracK} className="pl-16 pr-4 pt-3 pb-3.5 bg-white border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-xs font-bold text-slate-600 flex-shrink-0">
                                          Fracc. {fracK}
                                        </span>
                                        {frac.sm
                                          ? <span className="text-[10px] text-slate-400 truncate">{fullName(frac.sm)}</span>
                                          : <span className="text-[10px] text-slate-300 italic">Sin SM</span>
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
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SM TAB ── */}
          {tab === 'sm' && (
            <div className="divide-y divide-slate-50">
              {loading ? <LoadingSkeleton /> :
               filteredSMs.length === 0 ? (
                <EmptyState
                  title={smsList.length === 0 ? 'Sin SMs registradas' : 'Sin resultados'}
                  sub={smsList.length === 0 ? 'No hay supervisores de manzana activos' : `No coincide con "${search}"`}
                />
              ) : filteredSMs.map(sm => {
                const smMovs = movsBySmUsuario[sm.usuario] ?? [];
                const count = smMovs.length;
                const smPct = (count / META) * 100;
                const smColor = count === 0 ? '#9CA3AF' : semaforoColor(smPct);
                const isOpen = !!openSms[sm.usuario];
                return (
                  <div key={sm.usuario}>
                    <button type="button" onClick={() => toggleSm(sm.usuario)}
                      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer text-left">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(sm.usuario)}`}>
                        {initials(sm)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{fullName(sm)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {[sm.seccion ? `Sec. ${sm.seccion}` : null,
                            sm.poligono ? `Sector ${sm.poligono}` : null,
                            sm.ubt ? `Fracc. ${sm.ubt}` : null]
                            .filter(Boolean).join(' · ') || '—'}
                        </p>
                        <div className="mt-1.5">
                          <MiniBar count={count} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2 min-w-[48px]">
                        <p className="text-sm font-bold tabular-nums" style={{ color: smColor }}>
                          {count}/{META}
                        </p>
                        <p className="text-[10px] tabular-nums" style={{ color: smColor }}>
                          {smPct.toFixed(0)}%
                        </p>
                        <div className="flex justify-end mt-1">
                          <Chevron open={isOpen} />
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="bg-slate-50/60 border-t border-slate-100">
                        {smMovs.length === 0 ? (
                          <p className="pl-14 pr-4 py-3 text-xs text-slate-400 italic">
                            Sin movilizadoras registradas
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100/60">
                            {smMovs.map(m => (
                              <div key={m.id ?? m.usuario}
                                className="flex items-center gap-3 pl-14 pr-4 py-2.5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${badgeColor(m.usuario)}`}>
                                  {initials(m)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-700 truncate">{fullName(m)}</p>
                                  <p className="text-[10px] text-slate-400 font-mono tracking-wide">{m.curp || '—'}</p>
                                </div>
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
          )}
        </div>
      </div>
    </div>
  );
}
