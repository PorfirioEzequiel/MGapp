import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, OverlayView } from '@react-google-maps/api';
import supabase from '../supabase/client';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../utils/googleMapsConfig';
import { MAP_STYLE_DEFS } from './mapStyles';

const EDOMEX_CENTER = { lat: 19.35, lng: -99.65 };

// El dump original trae un problema de codificación puntual (Ñ -> Ð) en un municipio.
const fixEncoding = (s) => String(s || '').replace(/Ð/g, 'Ñ').trim();
// Los nombres de Región MG vienen en MAYÚSCULAS en la fuente ("ATLACOMULCO");
// se muestran en Capitalizado para que no lean como gritos en la UI.
const toTitleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

// ── WKT parser ────────────────────────────────────────────────────────────
// Extrae cada anillo (exterior u hoyo) como el grupo de paréntesis más
// interno — funciona sin importar la profundidad de anidado, así que sirve
// igual para POLYGON simple, MULTIPOLYGON, y polígonos con hoyos (uniones
// de secciones tienen hoyos; las secciones individuales de Tecámac no).
const parseWKT = (wkt) => {
  if (!wkt) return [];
  const s = String(wkt).trim();
  const toPoints = (str) =>
    str.trim().split(',').map(coord => {
      const p = coord.trim().split(/\s+/);
      return { lat: Number(p[1]), lng: Number(p[0]) };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

  const groups = [];
  const rx = /\(([^()]+)\)/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const pts = toPoints(m[1]);
    if (pts.length > 2) groups.push(pts);
  }
  return groups;
};

const fmt = (v) => (v != null && v !== '' && !isNaN(v) ? Number(v).toLocaleString() : '—');

// ── Paleta guinda/gris (identidad MORENA) — tonos suaves, se cicla por índice ──
const REGION_PALETTE = [
  { fill: '#B15A6E', stroke: '#6B0B20' }, // guinda suave
  { fill: '#B8C2CE', stroke: '#64748B' }, // gris slate suave
  { fill: '#C48A98', stroke: '#8C2440' }, // guinda claro suave
  { fill: '#CBD2DB', stroke: '#94A3B8' }, // gris suave
  { fill: '#C16A7D', stroke: '#B0142E' }, // guinda rojizo suave
  { fill: '#D7DEE5', stroke: '#94A3B8' }, // gris muy claro
  { fill: '#9C5468', stroke: '#4A0714' }, // guinda oscuro suave
  { fill: '#C3CAD3', stroke: '#64748B' }, // gris azulado suave
];
const SELECTED_COLOR = { fill: '#FFFFFF', stroke: '#6B0B20' };
const GUINDA = '#6B0B20';

// Colores por ganador — capa electoral Senaduría 2024 (Mariela Gutiérrez, MORENA
// coalición, vs. la coalición PRI-PAN-PRD "Fuerza y Corazón por México").
const PARTY_COLORS_SENADO_EDOMEX = {
  MARIELA: { fill: '#B15A6E', stroke: '#6B0B20', label: 'Mariela Gutiérrez' },
  PRIAND:  { fill: '#7C93B0', stroke: '#3D5474', label: 'PRI · PAN · PRD' },
};
const getPathsCenter = (pathGroups) => {
  const all = pathGroups.flat();
  if (!all.length) return null;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
};

const RegionLabel = ({ position, children, faded }) => (
  <OverlayView position={position} mapPaneName="floatPane">
    <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
      <span style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'system-ui,-apple-system,sans-serif',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        padding: '2px 6px',
        borderRadius: 4,
        color: '#0f172a',
        background: faded ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(0,0,0,0.18)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}>
        {children}
      </span>
    </div>
  </OverlayView>
);

// Combobox buscable — reemplaza el <select> nativo del sistema operativo por
// un listbox propio: búsqueda en vivo, navegación con teclado, y una fila de
// metadato (secciones/votos) por opción que un <select> plano no puede mostrar.
const Combobox = ({ value, onChange, options, placeholder, getValue, getLabel, getMeta, emptyLabel = 'Sin resultados' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => getLabel(o).toLowerCase().includes(q));
  }, [options, query, getLabel]);

  const selected = useMemo(() => options.find(o => getValue(o) === value), [options, value, getValue]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(''); setHighlight(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (opt) => { onChange(getValue(opt)); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) commit(filtered[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 text-left border rounded-lg pl-3 pr-2.5 py-2 bg-white transition-colors"
        style={{ borderColor: open ? GUINDA : '#E2E8F0' }}
      >
        <span className={`text-sm truncate ${selected ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="flex-shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1L5 5L9 1" stroke={open ? GUINDA : '#94A3B8'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden" style={{ animation: 'comboIn 0.12s ease-out' }}>
          <div className="p-1.5 border-b border-slate-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder="Buscar…"
              className="w-full text-sm px-2 py-1.5 rounded-md bg-slate-50 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#6B0B20]"
            />
          </div>
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="text-xs text-slate-400 px-3 py-3 text-center">{emptyLabel}</p>}
            {filtered.map((o, i) => {
              const v = getValue(o);
              const isSelected = v === value;
              return (
                <button
                  key={v}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(o)}
                  className="w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 transition-colors"
                  style={{
                    backgroundColor: i === highlight ? '#FBE9ED' : 'transparent',
                    color: isSelected ? GUINDA : '#334155',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span className="truncate">{getLabel(o)}</span>
                  {getMeta && <span className="text-[10px] tabular-nums text-slate-400 flex-shrink-0">{getMeta(o)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const GenderBar = ({ total, hombres, mujeres }) => {
  if (!total || (!hombres && !mujeres)) return null;
  const pct = (n) => n ? `${((n / total) * 100).toFixed(1)}%` : null;
  return (
    <div className="mt-1.5">
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
        {hombres > 0 && <div className="h-full" style={{ width: `${(hombres / total) * 100}%`, backgroundColor: '#8C2440' }} />}
        {mujeres > 0 && <div className="h-full bg-slate-400" style={{ width: `${(mujeres / total) * 100}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1">
        {hombres > 0 && <span className="text-[11px] text-slate-500">♂ {fmt(hombres)} <span className="opacity-60">({pct(hombres)})</span></span>}
        {mujeres > 0 && <span className="text-[11px] text-slate-500">♀ {fmt(mujeres)} <span className="opacity-60">({pct(mujeres)})</span></span>}
      </div>
    </div>
  );
};

const VoteSummary = ({ mariela, priand, dark }) => {
  const total = (mariela || 0) + (priand || 0);
  if (!total) return null;
  const textColor = dark ? 'text-white opacity-90' : '';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center text-[11px] mb-1">
        <span className={textColor} style={!dark ? { color: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke } : undefined}>Mariela {fmt(mariela)}</span>
        <span className={textColor} style={!dark ? { color: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke } : undefined}>{fmt(priand)} PRI-PAN-PRD</span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden flex ${dark ? 'bg-white/20' : 'bg-slate-100'}`}>
        <div className="h-full" style={{ width: `${(mariela / total) * 100}%`, backgroundColor: dark ? '#ffffff' : PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }} />
        <div className="h-full" style={{ width: `${(priand / total) * 100}%`, backgroundColor: dark ? 'rgba(255,255,255,0.45)' : PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }} />
      </div>
    </div>
  );
};

// Chips de trabajo territorial (chalecos/gorras, lonas, promotores) — mismo
// dato disponible desde nivel Estado hasta Sección, siempre visible cuando
// la capa electoral está activa, no solo enterrado en el detalle de sección.
const TerritorialStats = ({ chalecos, lonas, promotores, dark }) => {
  const items = [
    { icon: '🦺', value: chalecos, label: 'Chalecos/gorras' },
    { icon: '🏳️', value: lonas, label: 'Lonas' },
    { icon: '🧑‍🤝‍🧑', value: promotores, label: 'Promotores' },
  ].filter(it => it.value > 0);
  if (!items.length) return null;
  return (
    <div className="flex gap-1.5 mt-2">
      {items.map(it => (
        <div key={it.label} className={`flex-1 rounded-lg px-2 py-1.5 text-center ${dark ? 'bg-white/10' : 'bg-slate-50 border border-slate-100'}`}>
          <p className="text-sm leading-none mb-0.5">{it.icon}</p>
          <p className={`text-xs font-bold tabular-nums leading-none ${dark ? 'text-white' : 'text-slate-700'}`}>{fmt(it.value)}</p>
          <p className={`text-[8px] uppercase tracking-wide mt-0.5 leading-none ${dark ? 'text-white/60' : 'text-slate-400'}`}>{it.label}</p>
        </div>
      ))}
    </div>
  );
};

// % de secciones con un/a responsable de sección ya asignado — misma métrica
// disponible en los 5 niveles (Estado, Región, Distrito, Municipio, Sección),
// útil para detectar zonas de la estructura territorial sin cubrir todavía.
const CoverageBadge = ({ pct, dark }) => {
  if (pct == null) return null;
  const color = pct >= 75 ? '#15803D' : pct >= 40 ? '#B45309' : '#B91C1C';
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/20' : 'bg-slate-100'}`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: dark ? '#ffffff' : color }} />
      </div>
      <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${dark ? 'text-white/80' : 'text-slate-500'}`}>{pct}% con responsable</span>
    </div>
  );
};

const NAME_CHIP_COLORS = ['#6B0B20', '#3D5474', '#8C2440', '#475569', '#B0142E', '#64748B'];
const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const PromotorList = ({ names }) => {
  const [expanded, setExpanded] = useState(false);
  if (!names?.length) return null;
  const shown = expanded ? names : names.slice(0, 6);
  return (
    <div className="pt-2 border-t border-slate-100">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Promotores en esta sección ({names.length})</p>
      <div className="space-y-1">
        {shown.map((name, i) => (
          <div key={name} className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: NAME_CHIP_COLORS[i % NAME_CHIP_COLORS.length] }}
            >
              {initials(name)}
            </span>
            <span className="text-[11px] text-slate-600 truncate">{name}</span>
          </div>
        ))}
      </div>
      {names.length > 6 && (
        <button onClick={() => setExpanded(e => !e)} className="text-[11px] font-medium mt-1.5 hover:underline" style={{ color: GUINDA }}>
          {expanded ? 'Ver menos' : `+${names.length - 6} más`}
        </button>
      )}
    </div>
  );
};

const SeccionDetail = ({ data, senado, promotores, onClose }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 mex-panel-in">
    <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
      <div>
        <p className="text-lg font-extrabold text-slate-900 leading-tight tracking-tight">Sección {data.SECCION}</p>
        <p className="text-xs text-slate-400 mt-0.5">{fixEncoding(data.NOMBRE_MUNICIPIO)}</p>
      </div>
      <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0" title="Cerrar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
    </div>
    <div className="flex gap-3 mb-2">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FBE9ED', color: GUINDA }}>Dto. Fed. {data.DISTRITO_FEDERAL}</span>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Dto. Loc. {data.DISTRITO_LOCAL}</span>
    </div>
    <div className="space-y-2">
      <div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Lista nominal</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: GUINDA }}>{fmt(data.LISTA_NOMINAL)}</span>
        </div>
        <GenderBar total={data.LISTA_NOMINAL} hombres={data.LISTA_HOMBRES} mujeres={data.LISTA_MUJERES} />
      </div>
      <div className="pt-2 border-t border-slate-100">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Padrón electoral</span>
          <span className="text-sm font-bold text-slate-700 tabular-nums">{fmt(data.PADRON_ELECTORAL)}</span>
        </div>
        <GenderBar total={data.PADRON_ELECTORAL} hombres={data.PADRON_HOMBRES} mujeres={data.PADRON_MUJERES} />
      </div>

      {senado && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Senaduría 2024</p>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }}>Mariela G.</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }}>{fmt(senado.votos_mariela)}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400">{senado.diferencia >= 0 ? '+' : ''}{fmt(senado.diferencia)}</span>
            <div className="flex-1 text-right">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }}>PRI-PAN-PRD</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }}>{fmt(senado.votos_priand)}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-100 mb-1">
            <div className="h-full" style={{ width: `${(senado.votos_mariela / senado.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }} />
            <div className="h-full" style={{ width: `${(senado.votos_priand / senado.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] text-slate-400">{senado.casillas} casillas</p>
            {senado.region && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Región {toTitleCase(senado.region)}</span>
            )}
          </div>
          <TerritorialStats chalecos={senado.chalecos} lonas={senado.lonas} promotores={senado.promotores} />
          {senado.responsable_seccion && (
            <p className="text-[11px] text-slate-500 mt-2"><span className="text-slate-400">Responsable:</span> {senado.responsable_seccion}</p>
          )}
          {senado.coordinador_regional && (
            <p className="text-[11px] text-slate-500"><span className="text-slate-400">Coordinador regional:</span> {senado.coordinador_regional}</p>
          )}
        </div>
      )}

      <PromotorList names={promotores} />
    </div>
  </div>
);

// Polígono memoizado: sólo re-renderiza si SUS propias props cambian
// (paths/color/isSelected/isHovered), no cuando cambia el hover de otro
// polígono hermano. Con cientos de secciones por municipio, esto evita que
// mover el mouse recalcule y repinte todo el set en cada frame.
const RegionPolygon = React.memo(function RegionPolygon({ id, paths, fillColor, strokeColor, strokeWeight, fillOpacity, zIndex, clickable = true, onSelectId, onHoverId }) {
  return (
    <Polygon
      paths={paths}
      onClick={() => onSelectId(id)}
      onMouseOver={() => onHoverId(id)}
      onMouseOut={() => onHoverId(null)}
      options={{ fillColor, strokeColor, strokeWeight, fillOpacity, zIndex, clickable }}
    />
  );
});

// Tarjeta flotante que sigue al cursor — mismo patrón que el hover tooltip
// de MapTerritorial.js (Tecámac), para no tener que hacer clic solo para
// ver secciones/lista nominal de un distrito o municipio.
const RegionHoverCard = ({ info, pos, containerRef }) => {
  if (!info || !containerRef.current) return null;
  const containerW = containerRef.current.offsetWidth;
  const containerH = containerRef.current.offsetHeight;
  const w = 220, h = 100;
  const flipX = pos.x + w + 20 > containerW;
  const flipY = pos.y + h + 10 > containerH;
  const style = {
    position: 'absolute',
    left: flipX ? pos.x - w - 12 : pos.x + 14,
    top: flipY ? pos.y - h - 10 : pos.y + 10,
    pointerEvents: 'none',
    zIndex: 50,
    width: w,
  };
  return (
    <div style={style} className="rounded-xl border border-slate-200 shadow-2xl p-3 bg-white">
      <p className="text-xs font-bold text-slate-900 leading-tight truncate">{info.title}</p>
      {info.subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{info.subtitle}</p>}
      {info.votos_mariela != null ? (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px]" style={{ color: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }}>Mariela G.</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke }}>{fmt(info.votos_mariela)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px]" style={{ color: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }}>PRI-PAN-PRD</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke }}>{fmt(info.votos_priand)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Lista nominal</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: GUINDA }}>{fmt(info.lista_nominal)}</span>
        </div>
      )}
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-[10px] text-slate-400">Secciones</span>
        <span className="text-xs font-semibold text-slate-600 tabular-nums">{info.secciones}</span>
      </div>
    </div>
  );
};

const MapaEstadoMexico = () => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [currentStyle, setCurrentStyle] = useState('claro');
  const styleDef = MAP_STYLE_DEFS[currentStyle];

  // ── Datos de fronteras (cargados una vez) ────────────────────────────────
  const [estado, setEstado] = useState(null);
  const [distritos, setDistritos] = useState([]);
  const [distritoMunicipios, setDistritoMunicipios] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [municipiosAll, setMunicipiosAll] = useState([]);
  const [municipiosIndex, setMunicipiosIndex] = useState([]);
  const [boundariesError, setBoundariesError] = useState(null);

  // ── Vista: partición oficial INE (Distrito Federal) vs. partición interna
  // de operación territorial (Región MG) — dos lentes distintas sobre el
  // mismo territorio, no se anidan entre sí (un Distrito Federal puede caer
  // en más de una Región MG, pero cada Municipio cae en una sola Región).
  const [viewMode, setViewMode] = useState('distrito'); // 'distrito' | 'region'

  // ── Selección / drill-down ───────────────────────────────────────────────
  const [selectedDistrito, setSelectedDistrito] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedMunicipio, setSelectedMunicipio] = useState(null);
  const [selectedSeccion, setSelectedSeccion] = useState(null);
  const [selectedDistritoLocal, setSelectedDistritoLocal] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [search, setSearch] = useState('');

  // ── Secciones reales del municipio activo ────────────────────────────────
  const [secciones, setSecciones] = useState([]);
  const [loadingSecciones, setLoadingSecciones] = useState(false);
  const [seccionesError, setSeccionesError] = useState(null);

  // ── Capa electoral (Senaduría 2024) — se carga solo al activarla ─────────
  const [electoralMode, setElectoralMode] = useState(null); // null | 'senado_2024'
  const [senadoRows, setSenadoRows] = useState(null);
  const [senadoLoading, setSenadoLoading] = useState(false);
  const [senadoError, setSenadoError] = useState(null);
  const [promotoresRows, setPromotoresRows] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/edomex_estado.json').then(r => r.json()),
      fetch('/edomex_distritos.json').then(r => r.json()),
      fetch('/edomex_distrito_municipios.json').then(r => r.json()),
      fetch('/edomex_regiones.json').then(r => r.json()),
      fetch('/edomex_municipios.json').then(r => r.json()),
      fetch('/municipios_edomex.json').then(r => r.json()),
    ])
      .then(([e, d, dm, rg, ma, m]) => {
        setEstado(e); setDistritos(d); setDistritoMunicipios(dm);
        setRegiones(rg); setMunicipiosAll(ma); setMunicipiosIndex(m);
      })
      .catch(err => { console.error('Error cargando fronteras del Estado de México', err); setBoundariesError('No se pudieron cargar los límites territoriales.'); });
  }, []);

  const toggleElectoralMode = useCallback(() => {
    setElectoralMode(prev => {
      const next = prev === 'senado_2024' ? null : 'senado_2024';
      return next;
    });
  }, []);

  useEffect(() => {
    if (electoralMode !== 'senado_2024' || senadoRows || senadoLoading) return;
    setSenadoLoading(true);
    fetch('/senado_2024_edomex.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setSenadoRows(m);
      })
      .catch(err => { console.error('Error cargando senado_2024_edomex.json', err); setSenadoError('No se pudo cargar la capa de Senaduría 2024.'); })
      .finally(() => setSenadoLoading(false));
  }, [electoralMode, senadoRows, senadoLoading]);

  useEffect(() => {
    if (electoralMode !== 'senado_2024' || promotoresRows) return;
    fetch('/promotores_edomex.json')
      .then(r => r.json())
      .then(setPromotoresRows)
      .catch(err => console.error('Error cargando promotores_edomex.json', err));
  }, [electoralMode, promotoresRows]);

  const level1Active = viewMode === 'region' ? selectedRegion != null : selectedDistrito != null;
  const currentLevel = selectedSeccion != null ? 3 : selectedMunicipio != null ? 2 : level1Active ? 1 : 0;
  const LEVELS = viewMode === 'region' ? ['Estado', 'Región', 'Municipio', 'Sección'] : ['Estado', 'Distrito', 'Municipio', 'Sección'];

  const municipiosDelDistrito = useMemo(
    () => distritoMunicipios.filter(dm => dm.distrito_federal === selectedDistrito).sort((a, b) => fixEncoding(a.nombre_municipio).localeCompare(fixEncoding(b.nombre_municipio))),
    [distritoMunicipios, selectedDistrito]
  );
  const municipiosDeRegion = useMemo(
    () => municipiosAll.filter(m => m.region === selectedRegion).sort((a, b) => fixEncoding(a.nombre_municipio).localeCompare(fixEncoding(b.nombre_municipio))),
    [municipiosAll, selectedRegion]
  );
  const municipiosNivel1 = viewMode === 'region' ? municipiosDeRegion : municipiosDelDistrito;

  const filteredMunicipiosIndex = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return [];
    return municipiosIndex.filter(m => fixEncoding(m.nombre).toUpperCase().includes(q)).slice(0, 12);
  }, [municipiosIndex, search]);

  const distritosLocalesDelMunicipio = useMemo(
    () => [...new Set(secciones.map(s => s.DISTRITO_LOCAL))].filter(v => v != null).sort((a, b) => a - b),
    [secciones]
  );

  const distritoColorMapLocal = useMemo(() => {
    const map = {};
    distritosLocalesDelMunicipio.forEach((d, i) => { map[d] = REGION_PALETTE[i % REGION_PALETTE.length]; });
    return map;
  }, [distritosLocalesDelMunicipio]);

  // ── Geometría pre-parseada por nivel ─────────────────────────────────────
  // parseWKT recorre strings de miles de caracteres con regex; sin memoizar,
  // se repetiría en cada render (p.ej. cada vez que cambia el hover) para
  // las cientas de secciones de un municipio grande. Se recalcula solo
  // cuando cambia el dataset real, no en cada interacción del mouse.
  const distritosPaths = useMemo(
    () => distritos.map(d => parseWKT(d.geometry)),
    [distritos]
  );
  const regionesPaths = useMemo(
    () => regiones.map(r => parseWKT(r.geometry)),
    [regiones]
  );
  const municipiosNivel1Paths = useMemo(
    () => municipiosNivel1.map(m => parseWKT(m.geometry)),
    [municipiosNivel1]
  );
  const seccionesPaths = useMemo(
    () => secciones.map(s => parseWKT(s.geometry)),
    [secciones]
  );
  const estadoPaths = useMemo(() => estado ? parseWKT(estado.geometry) : [], [estado]);

  const loadMunicipio = useCallback(async (municipio, distritoFederal) => {
    setSelectedMunicipio(municipio);
    setSelectedSeccion(null);
    setSelectedDistritoLocal(null);
    setHoveredKey(null);
    if (distritoFederal != null) setSelectedDistrito(distritoFederal);
    setLoadingSecciones(true);
    setSeccionesError(null);
    const { data, error } = await supabase.from('secciones_edomex').select('*').eq('MUNICIPIO', municipio);
    if (error) {
      console.error('Error cargando secciones_edomex', error);
      setSeccionesError('No se pudieron cargar las secciones de este municipio.');
      setSecciones([]);
    } else {
      setSecciones(data || []);
      if (distritoFederal == null && data && data[0]) setSelectedDistrito(data[0].DISTRITO_FEDERAL);
    }
    setLoadingSecciones(false);
    setSearch('');
  }, []);

  // Atajo del buscador rápido: entra directo a un municipio sin pasar por
  // Distrito/Región primero, pero deja marcado el nivel 1 correspondiente a
  // la vista activa, para que "← Regresar" no se salte directo al Estado.
  const handleQuickJump = useCallback((m) => {
    if (viewMode === 'region') setSelectedRegion(m.region ?? null);
    loadMunicipio(m.municipio, m.distritos_federales?.[0]);
  }, [viewMode, loadMunicipio]);

  const goToDistrito = useCallback((d) => {
    setSelectedDistrito(prev => prev === d ? null : d);
    setSelectedMunicipio(null);
    setSelectedSeccion(null);
    setSelectedDistritoLocal(null);
    setSecciones([]);
    setHoveredKey(null);
  }, []);

  // ── Handlers estables por id (para que RegionPolygon pueda memoizarse) ───
  const handleHoverDistrito  = useCallback((d) => setHoveredKey(d != null ? `d${d}` : null), []);
  const handleHoverRegion    = useCallback((r) => setHoveredKey(r != null ? `reg:${r}` : null), []);
  const handleHoverMunicipio = useCallback((m) => setHoveredKey(m != null ? `m${m}` : null), []);
  const handleHoverSeccion   = useCallback((s) => setHoveredKey(s != null ? `s${s}` : null), []);
  const handleSelectSeccion  = useCallback((s) => setSelectedSeccion(prev => prev === s ? null : s), []);
  const handleSelectMunicipioNivel1 = useCallback((municipio) => {
    const m = municipiosNivel1.find(x => x.municipio === municipio);
    if (m) loadMunicipio(m.municipio, m.distrito_federal ?? null);
  }, [municipiosNivel1, loadMunicipio]);

  const goToRegion = useCallback((r) => {
    setSelectedRegion(prev => prev === r ? null : r);
    setSelectedMunicipio(null);
    setSelectedSeccion(null);
    setSelectedDistritoLocal(null);
    setSecciones([]);
    setHoveredKey(null);
  }, []);

  const switchViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedDistrito(null);
    setSelectedRegion(null);
    setSelectedMunicipio(null);
    setSelectedSeccion(null);
    setSelectedDistritoLocal(null);
    setSecciones([]);
    setHoveredKey(null);
  }, []);

  const resetToEstado = useCallback(() => {
    setSelectedDistrito(null);
    setSelectedRegion(null);
    setSelectedMunicipio(null);
    setSelectedSeccion(null);
    setSelectedDistritoLocal(null);
    setSecciones([]);
    setHoveredKey(null);
  }, []);

  const backOneLevel = useCallback(() => {
    if (selectedSeccion != null) { setSelectedSeccion(null); return; }
    if (selectedMunicipio != null) { setSelectedMunicipio(null); setSelectedDistritoLocal(null); setSecciones([]); return; }
    if (viewMode === 'region') { if (selectedRegion != null) setSelectedRegion(null); return; }
    if (selectedDistrito != null) { setSelectedDistrito(null); return; }
  }, [selectedSeccion, selectedMunicipio, selectedDistrito, selectedRegion, viewMode]);

  const handleContainerMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Tarjeta de hover: solo para los niveles Estado (distritos/regiones) y
  // Distrito/Región (municipios) — a nivel Sección ya existe el detalle al
  // hacer clic.
  const electoralActive = electoralMode === 'senado_2024' && !!senadoRows;

  const hoveredInfo = useMemo(() => {
    if (!hoveredKey) return null;
    if (hoveredKey.startsWith('reg:')) {
      const name = hoveredKey.slice(4);
      const r = regiones.find(x => x.region === name);
      if (!r) return null;
      return {
        title: `Región ${toTitleCase(r.region)}`, subtitle: `${r.municipios.length} municipios`,
        lista_nominal: r.lista_nominal, secciones: r.secciones,
        votos_mariela: electoralActive ? r.votos_mariela : null, votos_priand: electoralActive ? r.votos_priand : null,
      };
    }
    if (hoveredKey.startsWith('d')) {
      const id = Number(hoveredKey.slice(1));
      const d = distritos.find(x => x.distrito_federal === id);
      if (!d) return null;
      return {
        title: `Distrito ${d.distrito_federal}`, subtitle: fixEncoding(d.nombre_distrito_federal),
        lista_nominal: d.lista_nominal, secciones: d.secciones,
        votos_mariela: electoralActive ? d.votos_mariela : null, votos_priand: electoralActive ? d.votos_priand : null,
      };
    }
    if (hoveredKey.startsWith('m')) {
      const id = Number(hoveredKey.slice(1));
      const m = municipiosNivel1.find(x => x.municipio === id);
      if (!m) return null;
      return {
        title: fixEncoding(m.nombre_municipio), subtitle: m.distrito_federal != null ? `Distrito ${m.distrito_federal}` : `Región ${toTitleCase(m.region)}`,
        lista_nominal: m.lista_nominal, secciones: m.secciones,
        votos_mariela: electoralActive ? m.votos_mariela : null, votos_priand: electoralActive ? m.votos_priand : null,
      };
    }
    return null;
  }, [hoveredKey, distritos, regiones, municipiosNivel1, electoralActive]);

  // ── Auto-encuadre según el nivel activo ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let has = false;
    const extend = (wkt) => parseWKT(wkt).flat().forEach(p => { bounds.extend(p); has = true; });

    if (selectedSeccion != null) {
      const sec = secciones.find(s => s.SECCION === selectedSeccion);
      if (sec) extend(sec.geometry);
    } else if (selectedMunicipio != null && secciones.length) {
      secciones.forEach(s => extend(s.geometry));
    } else if (viewMode === 'region' && selectedRegion != null) {
      const r = regiones.find(x => x.region === selectedRegion);
      if (r) extend(r.geometry);
    } else if (viewMode === 'distrito' && selectedDistrito != null) {
      const d = distritos.find(x => x.distrito_federal === selectedDistrito);
      if (d) extend(d.geometry);
    } else if (estado) {
      extend(estado.geometry);
    }
    if (has) mapRef.current.fitBounds(bounds, selectedSeccion != null ? 80 : 28);
  }, [selectedSeccion, selectedMunicipio, secciones, selectedDistrito, selectedRegion, viewMode, distritos, regiones, estado]);

  const seccionDetalle = selectedSeccion != null ? secciones.find(s => s.SECCION === selectedSeccion) : null;

  const totalListaNominalMunicipio = useMemo(
    () => secciones.reduce((s, r) => s + (Number(r.LISTA_NOMINAL) || 0), 0),
    [secciones]
  );

  const municipioVotos = useMemo(() => {
    if (!electoralActive || !secciones.length) return null;
    const acc = secciones.reduce((a, s) => {
      const row = senadoRows[s.SECCION];
      if (!row) return a;
      a.mariela += row.votos_mariela;
      a.priand += row.votos_priand;
      a.chalecos += row.chalecos || 0;
      a.lonas += row.lonas || 0;
      a.promotores += row.promotores || 0;
      if (row.responsable_seccion) a.conResponsable += 1;
      return a;
    }, { mariela: 0, priand: 0, chalecos: 0, lonas: 0, promotores: 0, conResponsable: 0 });
    acc.cobertura = Math.round(100 * acc.conResponsable / secciones.length);
    return acc;
  }, [electoralActive, secciones, senadoRows]);

  const selectedDistritoData = selectedDistrito != null ? distritos.find(d => d.distrito_federal === selectedDistrito) : null;
  const selectedRegionData = selectedRegion != null ? regiones.find(r => r.region === selectedRegion) : null;

  const estadoVotos = useMemo(() => {
    if (!electoralActive || !distritos.length) return null;
    return distritos.reduce((acc, d) => ({
      mariela: acc.mariela + (d.votos_mariela || 0),
      priand: acc.priand + (d.votos_priand || 0),
      chalecos: acc.chalecos + (d.chalecos || 0),
      lonas: acc.lonas + (d.lonas || 0),
      promotores: acc.promotores + (d.promotores || 0),
    }), { mariela: 0, priand: 0, chalecos: 0, lonas: 0, promotores: 0 });
  }, [electoralActive, distritos]);

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 56px)' }}>
      <style>{`
        @keyframes comboIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes panelIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .mex-panel-in { animation: panelIn 0.22s ease-out; }
      `}</style>
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto">
        {/* Stepper de nivel */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-50">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">Nivel de análisis</p>
          <div className="flex items-center gap-0">
            {LEVELS.map((lbl, i) => (
              <React.Fragment key={i}>
                <button
                  onClick={() => {
                    if (i === 0) resetToEstado();
                    if (i === 1 && level1Active) { setSelectedMunicipio(null); setSelectedSeccion(null); setSecciones([]); }
                    if (i === 2 && selectedMunicipio != null) setSelectedSeccion(null);
                  }}
                  disabled={i > currentLevel}
                  className={`flex flex-col items-center gap-1 px-1 transition-all ${i > currentLevel ? 'opacity-25 cursor-default' : 'cursor-pointer'}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                    style={
                      i === currentLevel ? { backgroundColor: GUINDA, color: '#fff' }
                      : i < currentLevel ? { backgroundColor: '#FBE9ED', color: GUINDA }
                      : { backgroundColor: '#F1F5F9', color: '#94A3B8' }
                    }
                  >
                    {i < currentLevel ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] font-semibold whitespace-nowrap ${i === currentLevel ? '' : i < currentLevel ? 'text-slate-500' : 'text-slate-300'}`} style={i === currentLevel ? { color: GUINDA } : undefined}>{lbl}</span>
                </button>
                {i < 3 && <div className="flex-1 h-px mt-[-14px] mb-4 transition-all" style={{ backgroundColor: i < currentLevel ? '#F0C6D0' : '#F1F5F9' }} />}
              </React.Fragment>
            ))}
          </div>
          {currentLevel > 0 && (
            <button onClick={backOneLevel} className="mt-1 text-[11px] font-medium hover:underline" style={{ color: GUINDA }}>← Regresar</button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {boundariesError && <p className="text-xs text-red-500">{boundariesError}</p>}

          {/* Buscador rápido de municipio */}
          <div>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar municipio directo…"
                className="w-full text-sm border border-slate-200 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[#F0C6D0] focus:border-[#6B0B20] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
            {filteredMunicipiosIndex.length > 0 && (
              <div className="mt-1.5 border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-50">
                {filteredMunicipiosIndex.map(m => (
                  <button
                    key={m.municipio}
                    onClick={() => handleQuickJump(m)}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{fixEncoding(m.nombre)}</span>
                    <span className="text-[10px] tabular-nums text-slate-300 flex-shrink-0">{m.secciones}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nivel Estado: resumen + selector de vista + lista de distritos/regiones */}
          {currentLevel === 0 && estado && (
            <div className="mex-panel-in" key="panel-estado">
              <div className="rounded-xl p-3 text-white" style={{ background: `linear-gradient(135deg, ${GUINDA}, #360008)` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">Estado de México</p>
                <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight">{fmt(estado.lista_nominal)}</p>
                <p className="text-[11px] opacity-70 mt-1">lista nominal · {estado.municipios} municipios · {estado.secciones} secciones</p>
                {estadoVotos && <VoteSummary mariela={estadoVotos.mariela} priand={estadoVotos.priand} dark />}
                {estadoVotos && <TerritorialStats chalecos={estadoVotos.chalecos} lonas={estadoVotos.lonas} promotores={estadoVotos.promotores} dark />}
                <CoverageBadge pct={estado.cobertura_responsables} dark />
              </div>

              <div className="mt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Ver por</p>
                <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => switchViewMode('distrito')}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={viewMode === 'distrito' ? { backgroundColor: '#fff', color: GUINDA, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: '#64748B' }}
                  >
                    Distrito Federal
                  </button>
                  <button
                    onClick={() => switchViewMode('region')}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={viewMode === 'region' ? { backgroundColor: '#fff', color: GUINDA, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: '#64748B' }}
                  >
                    Región MG
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                  {viewMode === 'distrito'
                    ? 'Distritación oficial del INE — la que rige elecciones.'
                    : 'Regionalización interna de operación territorial — agrupa municipios completos bajo un mando regional.'}
                </p>
              </div>

              <div className="mt-3">
                {viewMode === 'distrito' ? (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Distrito Federal</p>
                    <Combobox
                      placeholder={`Elegir entre ${distritos.length} distritos…`}
                      value={selectedDistrito}
                      onChange={v => goToDistrito(v)}
                      options={distritos}
                      getValue={d => d.distrito_federal}
                      getLabel={d => `Dto. ${d.distrito_federal} — ${fixEncoding(d.nombre_distrito_federal)}`}
                      getMeta={d => `${d.secciones} secc.`}
                    />
                  </>
                ) : (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Región MG ({regiones.length})</p>
                    <Combobox
                      placeholder={`Elegir entre ${regiones.length} regiones…`}
                      value={selectedRegion}
                      onChange={v => goToRegion(v)}
                      options={regiones}
                      getValue={r => r.region}
                      getLabel={r => toTitleCase(r.region)}
                      getMeta={r => `${r.municipios.length} mun.`}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Nivel Distrito/Región: resumen + lista de municipios */}
          {currentLevel === 1 && (viewMode === 'region' ? selectedRegionData : selectedDistritoData) && (
            <div className="mex-panel-in" key="panel-nivel1">
              {viewMode === 'region' ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-700">Región {toTitleCase(selectedRegionData.region)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{selectedRegionData.municipios.length} municipios · {selectedRegionData.secciones} secciones</p>
                  <p className="text-xl font-extrabold tabular-nums mt-1 tracking-tight" style={{ color: GUINDA }}>{fmt(selectedRegionData.lista_nominal)} <span className="text-[10px] font-normal text-slate-400">lista nominal</span></p>
                  {electoralActive && <VoteSummary mariela={selectedRegionData.votos_mariela} priand={selectedRegionData.votos_priand} />}
                  {electoralActive && <TerritorialStats chalecos={selectedRegionData.chalecos} lonas={selectedRegionData.lonas} promotores={selectedRegionData.promotores} />}
                  <CoverageBadge pct={selectedRegionData.cobertura_responsables} />
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-700">{fixEncoding(selectedDistritoData.nombre_distrito_federal)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distrito {selectedDistritoData.distrito_federal} · {selectedDistritoData.secciones} secciones</p>
                  <p className="text-xl font-extrabold tabular-nums mt-1 tracking-tight" style={{ color: GUINDA }}>{fmt(selectedDistritoData.lista_nominal)} <span className="text-[10px] font-normal text-slate-400">lista nominal</span></p>
                  {electoralActive && <VoteSummary mariela={selectedDistritoData.votos_mariela} priand={selectedDistritoData.votos_priand} />}
                  {electoralActive && <TerritorialStats chalecos={selectedDistritoData.chalecos} lonas={selectedDistritoData.lonas} promotores={selectedDistritoData.promotores} />}
                  <CoverageBadge pct={selectedDistritoData.cobertura_responsables} />
                </div>
              )}
              <div className="mt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Municipio ({municipiosNivel1.length})</p>
                <Combobox
                  placeholder="Elegir municipio…"
                  value={selectedMunicipio}
                  onChange={v => handleSelectMunicipioNivel1(v)}
                  options={municipiosNivel1}
                  getValue={m => m.municipio}
                  getLabel={m => fixEncoding(m.nombre_municipio)}
                  getMeta={m => `${m.secciones} secc.`}
                />
              </div>
            </div>
          )}

          {/* Nivel Municipio / Sección: detalle */}
          {currentLevel >= 2 && (
            <div className="space-y-3">
              {loadingSecciones ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-1 py-2">
                  <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#F0C6D0', borderTopColor: GUINDA }} />
                  Cargando secciones…
                </div>
              ) : seccionesError ? (
                <p className="text-xs text-red-500 px-1">{seccionesError}</p>
              ) : (
                <>
                  {distritosLocalesDelMunicipio.length > 1 && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Distrito Local</p>
                      <Combobox
                        placeholder="Todos los distritos locales"
                        value={selectedDistritoLocal}
                        onChange={v => setSelectedDistritoLocal(v)}
                        options={distritosLocalesDelMunicipio.map(d => ({ id: d }))}
                        getValue={o => o.id}
                        getLabel={o => `Distrito local ${o.id}`}
                      />
                    </div>
                  )}
                  {seccionDetalle ? (
                    <SeccionDetail
                      data={seccionDetalle}
                      senado={senadoRows?.[seccionDetalle.SECCION]}
                      promotores={promotoresRows?.[seccionDetalle.SECCION]}
                      onClose={() => setSelectedSeccion(null)}
                    />
                  ) : (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 mex-panel-in" key={`muni-${selectedMunicipio}`}>
                      <p className="text-xs font-bold text-slate-700">{fixEncoding(secciones[0]?.NOMBRE_MUNICIPIO ?? '')}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{secciones.length} secciones · Lista nominal {fmt(totalListaNominalMunicipio)}</p>
                      {municipioVotos && <VoteSummary mariela={municipioVotos.mariela} priand={municipioVotos.priand} />}
                      {municipioVotos && <TerritorialStats chalecos={municipioVotos.chalecos} lonas={municipioVotos.lonas} promotores={municipioVotos.promotores} />}
                      {municipioVotos && <CoverageBadge pct={municipioVotos.cobertura} />}
                      <p className="text-[11px] text-slate-400 mt-2">Toca una sección en el mapa para ver su detalle.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Mapa ──────────────────────────────────────────────────────────── */}
      <main ref={containerRef} onMouseMove={handleContainerMouseMove} className="flex-1 min-w-0 relative">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-full bg-slate-100">
            <p className="text-slate-400 text-sm">Cargando mapa…</p>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={EDOMEX_CENTER}
            zoom={8}
            onLoad={map => { mapRef.current = map; }}
            options={{
              mapTypeId: styleDef.mapTypeId,
              streetViewControl: false,
              fullscreenControl: false,
              styles: styleDef.styles,
            }}
          >
            {/* Contorno del estado (siempre visible, de fondo) */}
            {estadoPaths.length > 0 && (
              <Polygon
                paths={estadoPaths}
                options={{ fillOpacity: 0, strokeColor: GUINDA, strokeWeight: 1.5, strokeOpacity: 0.5, clickable: false, zIndex: 0 }}
              />
            )}

            {/* Nivel Estado, vista Distrito Federal */}
            {currentLevel === 0 && viewMode === 'distrito' && distritos.map((d, i) => {
              const paths = distritosPaths[i];
              if (!paths?.length) return null;
              const color = electoralActive ? PARTY_COLORS_SENADO_EDOMEX[d.ganador] || REGION_PALETTE[0] : REGION_PALETTE[i % REGION_PALETTE.length];
              const isHovered = hoveredKey === `d${d.distrito_federal}`;
              return (
                <RegionPolygon
                  key={d.distrito_federal}
                  id={d.distrito_federal}
                  paths={paths}
                  onSelectId={goToDistrito}
                  onHoverId={handleHoverDistrito}
                  fillColor={color.fill}
                  strokeColor={color.stroke}
                  strokeWeight={isHovered ? 2 : 1}
                  fillOpacity={isHovered ? 0.55 : 0.3}
                  zIndex={1}
                />
              );
            })}
            {currentLevel === 0 && viewMode === 'distrito' && distritos.map((d, i) => {
              const center = getPathsCenter(distritosPaths[i]);
              if (!center) return null;
              return <RegionLabel key={`lbl-d-${d.distrito_federal}`} position={center}>{d.distrito_federal}</RegionLabel>;
            })}

            {/* Nivel Estado, vista Región MG */}
            {currentLevel === 0 && viewMode === 'region' && regiones.map((r, i) => {
              const paths = regionesPaths[i];
              if (!paths?.length) return null;
              const color = electoralActive ? PARTY_COLORS_SENADO_EDOMEX[r.ganador] || REGION_PALETTE[0] : REGION_PALETTE[i % REGION_PALETTE.length];
              const isHovered = hoveredKey === `reg:${r.region}`;
              return (
                <RegionPolygon
                  key={r.region}
                  id={r.region}
                  paths={paths}
                  onSelectId={goToRegion}
                  onHoverId={handleHoverRegion}
                  fillColor={color.fill}
                  strokeColor={color.stroke}
                  strokeWeight={isHovered ? 2 : 1}
                  fillOpacity={isHovered ? 0.55 : 0.3}
                  zIndex={1}
                />
              );
            })}
            {currentLevel === 0 && viewMode === 'region' && regiones.map((r, i) => {
              const center = getPathsCenter(regionesPaths[i]);
              if (!center) return null;
              return <RegionLabel key={`lbl-r-${r.region}`} position={center}>{toTitleCase(r.region)}</RegionLabel>;
            })}

            {/* Nivel Distrito/Región: municipios dentro del nivel 1 seleccionado */}
            {currentLevel === 1 && municipiosNivel1.map((m, i) => {
              const paths = municipiosNivel1Paths[i];
              if (!paths?.length) return null;
              const color = electoralActive ? PARTY_COLORS_SENADO_EDOMEX[m.ganador] || REGION_PALETTE[0] : REGION_PALETTE[i % REGION_PALETTE.length];
              const isHovered = hoveredKey === `m${m.municipio}`;
              return (
                <RegionPolygon
                  key={m.municipio}
                  id={m.municipio}
                  paths={paths}
                  onSelectId={handleSelectMunicipioNivel1}
                  onHoverId={handleHoverMunicipio}
                  fillColor={color.fill}
                  strokeColor={color.stroke}
                  strokeWeight={isHovered ? 2.5 : 1.5}
                  fillOpacity={isHovered ? 0.55 : 0.3}
                  zIndex={1}
                />
              );
            })}
            {currentLevel === 1 && municipiosNivel1.map((m, i) => {
              const center = getPathsCenter(municipiosNivel1Paths[i]);
              if (!center) return null;
              return <RegionLabel key={`lbl-m-${m.municipio}`} position={center}>{fixEncoding(m.nombre_municipio)}</RegionLabel>;
            })}

            {/* Nivel Municipio/Sección: secciones reales */}
            {currentLevel >= 2 && secciones.map((sec, i) => {
              const paths = seccionesPaths[i];
              if (!paths?.length) return null;
              const isSelected = selectedSeccion === sec.SECCION;
              const isHovered = hoveredKey === `s${sec.SECCION}`;
              const isFilteredOut = selectedDistritoLocal != null && sec.DISTRITO_LOCAL !== selectedDistritoLocal;
              const seccionSenado = electoralActive ? senadoRows[sec.SECCION] : null;
              const color = seccionSenado
                ? PARTY_COLORS_SENADO_EDOMEX[seccionSenado.ganador] || REGION_PALETTE[0]
                : distritoColorMapLocal[sec.DISTRITO_LOCAL] || REGION_PALETTE[0];
              return (
                <RegionPolygon
                  key={sec.SECCION}
                  id={sec.SECCION}
                  paths={paths}
                  onSelectId={handleSelectSeccion}
                  onHoverId={handleHoverSeccion}
                  fillColor={isSelected ? SELECTED_COLOR.fill : color.fill}
                  strokeColor={isSelected ? SELECTED_COLOR.stroke : color.stroke}
                  strokeWeight={isSelected ? 3 : isHovered ? 2 : 1}
                  fillOpacity={isFilteredOut ? 0.08 : isSelected ? 0.85 : isHovered ? 0.6 : 0.4}
                  zIndex={isSelected ? 3 : 2}
                />
              );
            })}
          </GoogleMap>
        )}

        {/* Selector de capa (igual que en Tecámac) + capas electorales */}
        {isLoaded && (
          <div className="no-print absolute top-3 left-3 z-10 flex flex-col gap-1 max-w-xs bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-200">
            <div className="flex flex-wrap gap-1">
              {Object.entries(MAP_STYLE_DEFS).map(([key, def]) => (
                <button
                  key={key}
                  onClick={() => setCurrentStyle(key)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={currentStyle === key ? { backgroundColor: GUINDA, color: '#fff' } : { color: '#4B5563' }}
                >
                  {def.label}
                </button>
              ))}
            </div>
            <div className="w-full h-px bg-gray-200" />
            <button
              onClick={toggleElectoralMode}
              disabled={senadoLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'senado_2024' ? { backgroundColor: GUINDA, color: '#fff' } : { color: '#4B5563' }}
              title="Resultados internos — Senaduría 2024"
            >
              {senadoLoading ? 'Cargando…' : '🗳 Senaduría 2024 · Mariela Gutiérrez'}
            </button>
            {senadoError && <p className="text-[10px] text-red-500 px-1">{senadoError}</p>}
          </div>
        )}

        {electoralActive && (currentLevel === 0 || currentLevel === 1) && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-1.5 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_SENADO_EDOMEX.MARIELA.fill, border: `1px solid ${PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke}` }} />
              <span className="text-[10px] text-slate-600">{PARTY_COLORS_SENADO_EDOMEX.MARIELA.label}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_SENADO_EDOMEX.PRIAND.fill, border: `1px solid ${PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke}` }} />
              <span className="text-[10px] text-slate-600">{PARTY_COLORS_SENADO_EDOMEX.PRIAND.label}</span>
            </span>
          </div>
        )}

        {!electoralActive && currentLevel >= 2 && !loadingSecciones && !seccionesError && Object.keys(distritoColorMapLocal).length > 0 && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Distrito local</span>
            <div className="flex items-center gap-2">
              {Object.entries(distritoColorMapLocal).map(([d, c]) => (
                <span key={d} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
                  <span className="text-[10px] text-slate-600">{d}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {(currentLevel === 0 || currentLevel === 1) && (
          <RegionHoverCard info={hoveredInfo} pos={tooltipPos} containerRef={containerRef} />
        )}
      </main>
    </div>
  );
};

export default MapaEstadoMexico;
