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

// Gubernatura 2023 — cómputos definitivos IEEM por sección. La coalición
// "Juntos Hacemos Historia" (MORENA-PT-PVEM) venía pre-sumada en una sola
// columna del propio archivo oficial; "Va por el Estado de México"
// (PAN-PRI-PRD-NAEM) se agrupó sumando esos 4 partidos y sus 11 combinaciones
// de voto cruzado — así queda prácticamente binaria: Delfina vs. oposición,
// igual que pidió el usuario. Tono distinto al de Mariela (misma familia
// MORENA, pero es otra candidata/elección) para no confundir capas al
// alternar entre Senaduría 2024 y Gubernatura 2023.
const PARTY_COLORS_GUBERNATURA_2023 = {
  DELFINA:   { fill: '#D6467B', stroke: '#8E1345', label: 'Delfina Gómez' },
  OPOSICION: { fill: '#8D8478', stroke: '#4B4438', label: 'Va por el Edoméx' },
};

// Diputación Local 2024, Distrito 33 (Tecámac, Teotihuacán, Temascalapa, San
// Martín de las Pirámides, Axapusco y Nopaltepec) — cómputos definitivos
// IEEM por sección, filtrados a ID_DISTRITO_LOCAL=33. "Sigamos Haciendo
// Historia" (MORENA-PT-PVEM) = Samuel Hernández Cruz; "Va por el Estado de
// México" (PAN-PRI-PRD-NAEM) = Lili Urbina. MC corrió por fuera de ambas
// coaliciones (13,707 votos) y se excluye del cálculo binario, igual que se
// excluye de la nota periodística que reporta el resultado como 117,323 vs
// 78,307 — cifra contra la que se verificó este cálculo (117,323/78,308).
// A diferencia de Gubernatura/Senaduría, esta capa solo tiene datos reales
// en los 6 municipios del Distrito 33 — el resto del estado queda sin dato.
const PARTY_COLORS_DIP_LOCAL_2024 = {
  SAMUEL:    { fill: '#D9622B', stroke: '#8A3712', label: 'Samuel Hernández' },
  OPOSICION: { fill: '#5B6B8C', stroke: '#33415C', label: 'Lili Urbina (oposición)' },
};
// Los 6 municipios que integran el Distrito Local 33 (según el propio
// cómputo IEEM) — esta elección no es estatal, así que la vista de esta
// capa se ancla a estos municipios en vez de al Estado completo.
const DL33_MUNICIPIOS = [16, 62, 76, 82, 85, 93]; // Axapusco, Nopaltepec, San Martín de las Pirámides, Tecámac, Temascalapa, Teotihuacán

// Colores fijos por nombre de Región MG (no por índice): en la elección 2024
// Mariela ganó las 9 regiones, así que colorear por "ganador" las vuelve
// todas del mismo guinda y la estructura territorial deja de verse. Aquí el
// color identifica la región, no el resultado electoral — y al ser por
// nombre (no por posición en el array), cada región siempre se ve del mismo
// color sin importar el orden en que llegue el JSON.
const REGION_MG_PALETTE = {
  ATLACOMULCO:     { fill: '#6B0B20', stroke: '#360008' }, // guinda (marca)
  ECATEPEC:        { fill: '#0F766E', stroke: '#134E4A' }, // verde azulado
  LERMA:           { fill: '#B45309', stroke: '#7C3A0A' }, // ámbar
  NAUCALPAN:       { fill: '#4C1D95', stroke: '#2E1065' }, // púrpura
  NEZAHUALCOYOTL:  { fill: '#4D7C0F', stroke: '#365314' }, // oliva
  TEJUPILCO:       { fill: '#C2410C', stroke: '#7C2D12' }, // terracota
  TEXCOCO:         { fill: '#0369A1', stroke: '#075985' }, // azul acero
  TOLUCA:          { fill: '#BE185D', stroke: '#831843' }, // magenta
  ZUMPANGO:        { fill: '#57534E', stroke: '#292524' }, // gris cálido
};

// Rampa secuencial de alto contraste (no guinda a propósito, para no
// confundirse con "ganó Mariela") — índice de marginación municipal 2020,
// CONAPO, esquema tipo YlOrRd. Estado de México no tiene municipios "Muy
// alto" en este corte (el más marginado real es "Alto"), pero se deja el
// escalón por si se actualiza el corte de datos más adelante.
const MARGINACION_COLOR_RAMP = {
  'Muy bajo': { fill: '#FFFBEB', stroke: '#D97706' },
  'Bajo':     { fill: '#FDE68A', stroke: '#B45309' },
  'Medio':    { fill: '#F59E0B', stroke: '#9A3412' },
  'Alto':     { fill: '#B91C1C', stroke: '#7F1D1D' },
  'Muy alto': { fill: '#5C0A0A', stroke: '#2D0505' },
};

// CONAPO invirtió la escala en la edición 2020: un IM_2020 MÁS BAJO significa
// MÁS marginación (contra-intuitivo) — verificado contra municipios rurales
// conocidos (San Felipe del Progreso, Villa Victoria) antes de fiar el color.
// Estado de México, corte 2020: rango real 49.69–60.95.
const MARGINACION_RANGE = { min: 49.69, max: 60.95 };
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerpColor = (hexA, hexB, t) => {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
};
// Continuo — solo para Distrito/Región, que promedian varios municipios y no
// tienen un único "grado" oficial. A nivel Municipio/Sección se usa el grado
// discreto de CONAPO (más nítido, ver MARGINACION_COLOR_RAMP) en vez de esto.
const marginacionColorForIndice = (im) => {
  if (im == null) return REGION_PALETTE[0];
  const { min, max } = MARGINACION_RANGE;
  // t=0 -> menos marginado (extremo "max"), t=1 -> más marginado (extremo "min")
  const t = Math.max(0, Math.min(1, (max - im) / (max - min)));
  const stops = [MARGINACION_COLOR_RAMP['Muy bajo'].fill, MARGINACION_COLOR_RAMP['Bajo'].fill, MARGINACION_COLOR_RAMP['Medio'].fill, MARGINACION_COLOR_RAMP['Alto'].fill];
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const localT = scaled - i;
  const fill = lerpColor(stops[i], stops[i + 1], localT);
  return { fill, stroke: t > 0.5 ? MARGINACION_COLOR_RAMP['Alto'].stroke : MARGINACION_COLOR_RAMP['Medio'].stroke };
};
// Peso 0–1 para el heatmap: qué tan marginado está, ya en la dirección
// intuitiva (1 = más marginado), sin importar la inversión de CONAPO.
const marginacionWeight = (im) => {
  if (im == null) return 0;
  const { min, max } = MARGINACION_RANGE;
  return Math.max(0, Math.min(1, (max - im) / (max - min)));
};

// De más a menos severo, para que los chips del filtro se lean como escala.
// Estado de México no tiene "Muy alto" en el corte 2020 — se omite del filtro
// (no tendría nada que mostrar).
const MARGINACION_GRADOS_PRESENTES = ['Alto', 'Medio', 'Bajo', 'Muy bajo'];

// ── Participación electoral (abstencionismo) ─────────────────────────────
// No es un dato nuevo: se calcula de lo que ya se cargó (votos_calculado /
// lista_nominal), Senaduría 2024. Escala divergente — verde = participación
// sana, rojo = abstención alta — distinta de las otras capas para no
// confundirse al cambiar de capa. Rango observado en los 125 municipios:
// 53.6%–84.7%; se deja margen (45–90) por si una sección puntual se sale.
const PARTICIPACION_RANGE = { min: 45, max: 90 };
const participacionPct = (listaNominal, votosCalculado) => {
  if (!listaNominal || votosCalculado == null) return null;
  return Math.max(0, Math.min(100, (votosCalculado / listaNominal) * 100));
};
const participacionColor = (pct) => {
  if (pct == null) return REGION_PALETTE[0];
  const { min, max } = PARTICIPACION_RANGE;
  const t = Math.max(0, Math.min(1, (pct - min) / (max - min))); // 0=abstención alta, 1=participación alta
  const stops = ['#B91C1C', '#F59E0B', '#65A30D', '#0D9488'];
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const fill = lerpColor(stops[i], stops[i + 1], scaled - i);
  return { fill, stroke: t < 0.4 ? '#7F1D1D' : '#134E4A' };
};

// ── Incidencia delictiva 2025 (SESNSP, fuero común, corte dic-2025) ──────
// Se colorea por TASA por 100 mil habitantes, no por conteo bruto — Ecatepec
// siempre va a tener más delitos que Zacazonapan solo por ser 30 veces más
// grande; comparar tasas es lo correcto. Aviso: en municipios chicos una
// tasa puede dispararse con pocos casos (Polotitlán: 22 homicidios = tasa
// altísima) — es un efecto estadístico conocido de "números pequeños", no
// necesariamente el municipio más peligroso del estado.
const CRIMEN_RANGE = { min: 261, max: 3193 }; // tasa_delitos_2025 x 100k, min-max real de los 125 municipios
// Espectro ampliado a propósito — mismo patrón (blanco-rosado → vino casi
// negro) pero con más distancia perceptual entre cada grado, para que la
// diferencia entre "Medio" y "Alto" no se pierda en tonos demasiado parecidos.
const CRIMEN_COLOR_RAMP = {
  'Bajo':     { fill: '#FEF2F2', stroke: '#FCA5A5' },
  'Medio':    { fill: '#F87171', stroke: '#DC2626' },
  'Alto':     { fill: '#B91C1C', stroke: '#7F1D1D' },
  'Muy alto': { fill: '#3B0505', stroke: '#180202' },
};
const CRIMEN_GRADOS = ['Muy alto', 'Alto', 'Medio', 'Bajo'];
const crimenColorForTasa = (tasa) => {
  if (tasa == null) return REGION_PALETTE[0];
  const { min, max } = CRIMEN_RANGE;
  const t = Math.max(0, Math.min(1, (tasa - min) / (max - min)));
  const stops = [CRIMEN_COLOR_RAMP['Bajo'].fill, CRIMEN_COLOR_RAMP['Medio'].fill, CRIMEN_COLOR_RAMP['Alto'].fill, CRIMEN_COLOR_RAMP['Muy alto'].fill];
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const fill = lerpColor(stops[i], stops[i + 1], scaled - i);
  return { fill, stroke: t > 0.5 ? CRIMEN_COLOR_RAMP['Muy alto'].stroke : CRIMEN_COLOR_RAMP['Alto'].stroke };
};
// Cuartiles reales de los 125 municipios (tasa_delitos_2025) — clasificación
// por cuantiles, no por corte fijo arbitrario: así cada categoría agrupa un
// número comparable de municipios, el método correcto cuando la variable
// tiene outliers (aquí, municipios chicos con tasas infladas).
const crimenGradoForTasa = (tasa) => {
  if (tasa == null) return null;
  if (tasa >= 2143.4) return 'Muy alto'; // Q4
  if (tasa >= 1756.5) return 'Alto';     // Q3
  if (tasa >= 1088.5) return 'Medio';    // Q2
  return 'Bajo';                         // Q1
};

const PRIORIDAD_COLORS = {
  'Prioridad alta':        { bg: '#FEE2E2', text: '#991B1B' },
  'Vigilar':               { bg: '#FEF3C7', text: '#92400E' },
  'Consolidar con gestión':{ bg: '#DBEAFE', text: '#1E40AF' },
  'Estable':               { bg: '#F1F5F9', text: '#475569' },
  'Baja urgencia social':  { bg: '#F1F5F9', text: '#64748B' },
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

// Mancha de calor vía CSS (radial-gradient + blur) posicionada con OverlayView
// — Google retiró HeatmapLayer de la Maps JS API (no funciona desde la
// v3.65: https://developers.google.com/maps/deprecations), así que el
// degradado se dibuja en el propio DOM en vez de pedirle un kernel a Google.
// Varias manchas semitransparentes superpuestas producen el mismo efecto
// visual de acumulación que un heatmap real, sin depender de esa librería.
const HeatBlob = ({ position, weight }) => {
  const size = 70 + weight * 90;
  const o = 0.28 + weight * 0.4;
  return (
    <OverlayView position={position} mapPaneName="overlayLayer">
      <div
        style={{
          position: 'absolute',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          width: size,
          height: size,
          borderRadius: '50%',
          filter: 'blur(8px)',
          background: `radial-gradient(circle, rgba(92,10,10,${o}) 0%, rgba(185,28,28,${o * 0.75}) 30%, rgba(245,158,11,${o * 0.5}) 55%, rgba(255,251,235,0) 100%)`,
        }}
      />
    </OverlayView>
  );
};

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

// Genérico: por defecto muestra Senaduría 2024 (Mariela vs. PRI-PAN-PRD) para
// no tocar los usos ya existentes — Gubernatura 2023 le pasa sus propias
// etiquetas/colores (Delfina vs. Va por el Edoméx).
const VoteSummary = ({
  mariela, priand, dark,
  leftLabel = 'Mariela', rightLabel = 'PRI-PAN-PRD',
  leftColor = PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke, rightColor = PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke,
}) => {
  const total = (mariela || 0) + (priand || 0);
  if (!total) return null;
  const textColor = dark ? 'text-white opacity-90' : '';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center text-[11px] mb-1">
        <span className={textColor} style={!dark ? { color: leftColor } : undefined}>{leftLabel} {fmt(mariela)}</span>
        <span className={textColor} style={!dark ? { color: rightColor } : undefined}>{fmt(priand)} {rightLabel}</span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden flex ${dark ? 'bg-white/20' : 'bg-slate-100'}`}>
        <div className="h-full" style={{ width: `${(mariela / total) * 100}%`, backgroundColor: dark ? '#ffffff' : leftColor }} />
        <div className="h-full" style={{ width: `${(priand / total) * 100}%`, backgroundColor: dark ? 'rgba(255,255,255,0.45)' : rightColor }} />
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
      <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${dark ? 'text-white/80' : 'text-slate-500'}`} title="Estructura territorial 2025">{pct}% con responsable (2025)</span>
    </div>
  );
};

// Resumen compacto de marginación — se usa en Estado/Región/Distrito, donde
// solo hay un promedio ponderado por población, no el desglose completo.
const MarginacionSummary = ({ indice, dark }) => {
  if (indice == null) return null;
  const c = marginacionColorForIndice(indice);
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dark ? '#fff' : c.fill, border: `1px solid ${dark ? 'rgba(255,255,255,0.5)' : c.stroke}` }} />
      <span className={`text-[10px] ${dark ? 'text-white/80' : 'text-slate-500'}`}>Marginación promedio (CONAPO 2020, ponderada por población)</span>
    </div>
  );
};

// Desglose completo — solo tiene sentido a nivel Municipio, que es la
// granularidad real del dato oficial (CONAPO no publica esto por sección).
const MarginacionDetail = ({ data }) => {
  if (!data) return null;
  const pc = PRIORIDAD_COLORS[data.prioridad] || PRIORIDAD_COLORS['Baja urgencia social'];
  const factores = [
    { label: 'Analfabetismo', value: data.analfabetismo_pct },
    { label: 'Sin drenaje', value: data.sin_drenaje_pct },
    { label: 'Sin agua entubada', value: data.sin_agua_pct },
    { label: 'Hacinamiento', value: data.hacinamiento_pct },
    { label: 'Ingreso ≤ 2 salarios mín.', value: data.ingreso_bajo_pct },
  ];
  return (
    <div className="pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Marginación · CONAPO 2020</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: pc.bg, color: pc.text }}>{data.prioridad}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: marginacionColorForIndice(data.indice_marginacion).fill, border: `1px solid ${marginacionColorForIndice(data.indice_marginacion).stroke}` }} />
        <span className="text-sm font-extrabold text-slate-800">Grado {data.grado_marginacion.toLowerCase()}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">(IM {data.indice_marginacion})</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {factores.map(f => (
          <React.Fragment key={f.label}>
            <span className="text-slate-400">{f.label}</span>
            <span className="text-right font-semibold text-slate-600 tabular-nums">{f.value}%</span>
          </React.Fragment>
        ))}
      </div>
      {data.margen_electoral_pct != null && (
        <p className="text-[11px] text-slate-500 mt-2">
          <span className="text-slate-400">Margen Senaduría 2024:</span> {data.margen_electoral_pct >= 0 ? '+' : ''}{data.margen_electoral_pct} pts {data.margen_electoral_pct >= 0 ? 'Mariela' : 'PRI-PAN-PRD'}
        </p>
      )}
      <p className="text-[9px] text-slate-300 mt-1">Población: {fmt(data.poblacion)} · dato a nivel municipio</p>
    </div>
  );
};

// Resumen compacto de participación — se deriva de votos_calculado / lista_nominal,
// mismo par de campos que ya trae cada nivel agregado desde Senaduría 2024.
const ParticipacionSummary = ({ pct, dark }) => {
  if (pct == null) return null;
  const c = participacionColor(pct);
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dark ? '#fff' : c.fill, border: `1px solid ${dark ? 'rgba(255,255,255,0.5)' : c.stroke}` }} />
      <span className={`text-[10px] ${dark ? 'text-white/80' : 'text-slate-500'}`}>Participación estimada {pct.toFixed(1)}% (Senaduría 2024)</span>
    </div>
  );
};

// Resumen compacto de incidencia delictiva — tasa por 100k hab. (ya ajustada
// por población, no delitos crudos), mismo patrón que MarginacionSummary.
const CrimenSummary = ({ tasa, poblacion, dark }) => {
  if (tasa == null) return null;
  const c = crimenColorForTasa(tasa);
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dark ? '#fff' : c.fill, border: `1px solid ${dark ? 'rgba(255,255,255,0.5)' : c.stroke}` }} />
      <span className={`text-[10px] ${dark ? 'text-white/80' : 'text-slate-500'}`}>
        Incidencia delictiva: {fmt(Math.round(tasa))} delitos por cada 100k hab.{poblacion != null ? ` · pob. ${fmt(poblacion)}` : ''} (SESNSP, dic. 2025)
      </span>
    </div>
  );
};

// Desglose completo — solo tiene sentido a nivel Municipio, la granularidad
// real del dato SESNSP (no se publica por sección).
const CrimenDetail = ({ data }) => {
  if (!data) return null;
  const grado = crimenGradoForTasa(data.tasa_delitos_2025);
  const c = CRIMEN_COLOR_RAMP[grado] || CRIMEN_COLOR_RAMP['Bajo'];
  const darkText = grado === 'Bajo';
  return (
    <div className="pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Incidencia delictiva · SESNSP</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.fill, color: darkText ? '#450A0A' : '#fff' }}>{grado}</span>
      </div>
      <p className="text-sm font-extrabold text-slate-800 tabular-nums">{fmt(Math.round(data.tasa_delitos_2025))} <span className="text-[10px] font-normal text-slate-400">delitos / 100k hab.</span></p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-1.5">
        <span className="text-slate-400">Delitos totales 2025</span>
        <span className="text-right font-semibold text-slate-600 tabular-nums">{fmt(data.delitos_total_2025)}</span>
        <span className="text-slate-400">Alto impacto</span>
        <span className="text-right font-semibold text-slate-600 tabular-nums">{fmt(data.delitos_alto_impacto_2025)}</span>
        <span className="text-slate-400">Homicidios</span>
        <span className="text-right font-semibold text-slate-600 tabular-nums">{fmt(data.homicidios_2025)}</span>
        <span className="text-slate-400">Tasa homicidios</span>
        <span className="text-right font-semibold text-slate-600 tabular-nums">{data.tasa_homicidios_2025}</span>
      </div>
      <p className="text-[9px] text-slate-300 mt-1.5">SESNSP, fuero común, corte dic. 2025 · población {fmt(data.poblacion)}{data.poblacion < 30000 ? ' — municipio pequeño: cifras absolutas sensibles' : ''}</p>
    </div>
  );
};

// Panel de análisis electoral — números generales de la capa Senaduría 2024
// sobre el universo de secciones del nivel/filtro activo (Estado, Distrito,
// Región o Municipio): cuántas secciones se ganaron/perdieron y cuántos
// votos sumó cada lado ahí. Sin listas ni clasificaciones extra — es un
// visor, se lee de un vistazo. Vive fuera de los paneles por nivel (como los
// controles de marginación/crimen) para no desaparecer al hacer drill-down.
// Genérico: sirve tanto para Senaduría 2024 como para Gubernatura 2023 (o
// cualquier otra capa binaria futura) — recibe sus propias etiquetas/colores
// en vez de asumir un partido fijo.
const ElectoralAnalysisPanel = ({
  analysis, title, eleccionLabel,
  leftLabel = 'Mariela G.', rightLabel = 'PRI-PAN-PRD',
  leftColor = PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke, rightColor = PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke,
}) => {
  if (!analysis) return null;
  const { total, ganadas, perdidas, pctGanadas, votosIzq, votosDer, margenGlobalPct, sinDato } = analysis;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '#F0C6D0', background: '#FEFAFB' }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5" style={{ color: GUINDA }}>Análisis electoral · {title}</p>
      <p className="text-[9px] text-slate-400 mb-2">{total} secciones con dato de {eleccionLabel}</p>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
          <p className="text-[9px] text-slate-400">Secciones ganadas</p>
          <p className="text-lg font-extrabold tabular-nums" style={{ color: leftColor }}>{ganadas} <span className="text-[10px] font-normal text-slate-400">({pctGanadas}%)</span></p>
        </div>
        <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
          <p className="text-[9px] text-slate-400">Secciones perdidas</p>
          <p className="text-lg font-extrabold tabular-nums" style={{ color: rightColor }}>{perdidas} <span className="text-[10px] font-normal text-slate-400">({100 - pctGanadas}%)</span></p>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-slate-100 mb-3">
        <div className="h-full" style={{ width: `${(ganadas / total) * 100}%`, backgroundColor: leftColor }} />
        <div className="h-full" style={{ width: `${(perdidas / total) * 100}%`, backgroundColor: rightColor }} />
      </div>

      <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Votos {leftLabel}</span>
          <span className="font-bold tabular-nums" style={{ color: leftColor }}>{fmt(votosIzq)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Votos {rightLabel}</span>
          <span className="font-bold tabular-nums" style={{ color: rightColor }}>{fmt(votosDer)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Margen</span>
          <span className="font-bold tabular-nums" style={{ color: margenGlobalPct >= 0 ? leftColor : rightColor }}>
            {margenGlobalPct >= 0 ? '+' : ''}{margenGlobalPct.toFixed(1)} pts
          </span>
        </div>
      </div>
      {sinDato > 0 && (
        <p className="text-[9px] text-slate-300 mt-2 pt-2 border-t border-slate-100">{sinDato} secciones de este universo sin dato de {eleccionLabel}.</p>
      )}
    </div>
  );
};

// Desglose por municipio del Distrito Local 33 — específico de esa capa
// (las demás son estatales y se recorren navegando el mapa; esta cabe
// completa en una tabla). Cada fila salta directo al municipio.
const DipLocal33Breakdown = ({ municipios, onSelectMunicipio }) => {
  if (!municipios?.length) return null;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '#F0C6D0', background: '#FEFAFB' }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: GUINDA }}>Resultados por municipio · Distrito 33</p>
      <div className="space-y-2">
        {municipios.map(m => {
          const total = m.samuel + m.oposicion;
          const color = m.ganador === 'SAMUEL' ? PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke : PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke;
          return (
            <button
              key={m.municipio}
              onClick={() => onSelectMunicipio(m.municipio)}
              className="w-full text-left rounded-lg bg-white border border-slate-100 px-2.5 py-1.5 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 truncate">{fixEncoding(m.nombre ?? '')}</span>
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>{m.ganadas}-{m.perdidas}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-100">
                <div className="h-full" style={{ width: `${(m.samuel / total) * 100}%`, backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke }} />
                <div className="h-full" style={{ width: `${(m.oposicion / total) * 100}%`, backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[9px] text-slate-300 mt-2">Secciones ganadas–perdidas por municipio. Toca un municipio para ver su detalle.</p>
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

const SeccionDetail = ({ data, senado, promotores, marginacion, crimen, gubernatura, dipLocal, onClose }) => (
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
          {(() => {
            const pct = participacionPct(data.LISTA_NOMINAL, senado.votos_calculado);
            return pct != null ? (
              <p className="text-[11px] text-slate-500 mt-1">
                <span className="text-slate-400">Participación estimada:</span> <span className="font-bold" style={{ color: participacionColor(pct).fill }}>{pct.toFixed(1)}%</span>
              </p>
            ) : null;
          })()}
          <TerritorialStats chalecos={senado.chalecos} lonas={senado.lonas} promotores={senado.promotores} />
          {(senado.responsable_seccion || senado.coordinador_regional) && (
            <div className="mt-2">
              {senado.responsable_seccion && (
                <p className="text-[11px] text-slate-500"><span className="text-slate-400">Responsable:</span> {senado.responsable_seccion}</p>
              )}
              {senado.coordinador_regional && (
                <p className="text-[11px] text-slate-500"><span className="text-slate-400">Coordinador regional:</span> {senado.coordinador_regional}</p>
              )}
              <p className="text-[9px] text-slate-300 mt-0.5">Estructura territorial 2025</p>
            </div>
          )}
        </div>
      )}

      {gubernatura && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Gubernatura 2023 · IEEM</p>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke }}>Delfina G.</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke }}>{fmt(gubernatura.votos_delfina)}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400">{gubernatura.diferencia >= 0 ? '+' : ''}{fmt(gubernatura.diferencia)}</span>
            <div className="flex-1 text-right">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_GUBERNATURA_2023.OPOSICION.stroke }}>Va por el Edoméx</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_GUBERNATURA_2023.OPOSICION.stroke }}>{fmt(gubernatura.votos_oposicion)}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-100 mb-1">
            <div className="h-full" style={{ width: `${(gubernatura.votos_delfina / gubernatura.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke }} />
            <div className="h-full" style={{ width: `${(gubernatura.votos_oposicion / gubernatura.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_GUBERNATURA_2023.OPOSICION.stroke }} />
          </div>
          <p className="text-[11px] text-slate-400">{gubernatura.casillas} casillas · lista nominal {fmt(gubernatura.lista_nominal)}</p>
          <p className="text-[9px] text-slate-300 mt-0.5">Cómputos definitivos IEEM, gubernatura 2023</p>
        </div>
      )}

      {dipLocal && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Diputación Local 2024 · Distrito 33</p>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke }}>Samuel H.</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke }}>{fmt(dipLocal.votos_samuel)}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400">{dipLocal.diferencia >= 0 ? '+' : ''}{fmt(dipLocal.diferencia)}</span>
            <div className="flex-1 text-right">
              <p className="text-[10px] font-bold" style={{ color: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke }}>Lili Urbina</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke }}>{fmt(dipLocal.votos_oposicion)}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-100 mb-1">
            <div className="h-full" style={{ width: `${(dipLocal.votos_samuel / dipLocal.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke }} />
            <div className="h-full" style={{ width: `${(dipLocal.votos_oposicion / dipLocal.votos_calculado) * 100}%`, backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke }} />
          </div>
          <p className="text-[11px] text-slate-400">{dipLocal.casillas} casillas · lista nominal {fmt(dipLocal.lista_nominal)}</p>
          <p className="text-[9px] text-slate-300 mt-0.5">Cómputos definitivos IEEM, diputación local 2024</p>
        </div>
      )}

      <PromotorList names={promotores} />
      <MarginacionDetail data={marginacion} />
      <CrimenDetail data={crimen} />
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
  const [marginacionRows, setMarginacionRows] = useState(null);
  const [marginacionLoading, setMarginacionLoading] = useState(false);
  const [marginacionError, setMarginacionError] = useState(null);
  const [marginacionVista, setMarginacionVista] = useState('calor'); // 'calor' | 'coropletas'
  const [gradosVisibles, setGradosVisibles] = useState(() => new Set(MARGINACION_GRADOS_PRESENTES));
  const [crimenRows, setCrimenRows] = useState(null);
  const [crimenLoading, setCrimenLoading] = useState(false);
  const [crimenError, setCrimenError] = useState(null);
  // Filtro propio de grados para crimen — no comparte gradosVisibles con
  // marginación porque sus etiquetas de grado no coinciden 1:1 ('Muy alto'
  // vs 'Muy bajo'): compartir el Set dejaría 'Muy alto' oculto por defecto.
  const [crimenGradosVisibles, setCrimenGradosVisibles] = useState(() => new Set(CRIMEN_GRADOS));
  // Índice ligero SECCIÓN→MUNICIPIO/DISTRITO_FEDERAL/DISTRITO_LOCAL (sin
  // geometría, ~100KB) — permite agrupar el análisis electoral por Distrito
  // o Región sin cargar los 6,748 polígonos reales (esos solo se piden por
  // municipio, bajo demanda, por diseño de rendimiento).
  const [seccionesIndex, setSeccionesIndex] = useState(null);
  const [gubernaturaRows, setGubernaturaRows] = useState(null);
  const [gubernaturaLoading, setGubernaturaLoading] = useState(false);
  const [gubernaturaError, setGubernaturaError] = useState(null);
  const [dipLocalRows, setDipLocalRows] = useState(null);
  const [dipLocalLoading, setDipLocalLoading] = useState(false);
  const [dipLocalError, setDipLocalError] = useState(null);
  // Contorno real del Distrito Local 33 — unión de las 134 secciones que
  // hoy pertenecen a ese distrito (tabla en vivo, no el archivo estático de
  // 2024), para delimitarlo con su geometría real y no solo con el
  // contorno de los municipios que toca (varios, como Tecámac, están
  // partidos entre dos distritos locales).
  const [dl33Boundary, setDl33Boundary] = useState(null);

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

  const setElectoralLayer = useCallback((mode) => {
    setElectoralMode(prev => prev === mode ? null : mode);
  }, []);

  useEffect(() => {
    // 'participacion' reusa este mismo fetch — participación se deriva de
    // votos_calculado / lista_nominal, ambos ya vienen en este archivo.
    if ((electoralMode !== 'senado_2024' && electoralMode !== 'participacion') || senadoRows || senadoLoading) return;
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

  useEffect(() => {
    if (electoralMode !== 'marginacion' || marginacionRows || marginacionLoading) return;
    setMarginacionLoading(true);
    fetch('/marginacion_edomex.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.municipio] = row; });
        setMarginacionRows(m);
      })
      .catch(err => { console.error('Error cargando marginacion_edomex.json', err); setMarginacionError('No se pudo cargar la capa de marginación.'); })
      .finally(() => setMarginacionLoading(false));
  }, [electoralMode, marginacionRows, marginacionLoading]);

  useEffect(() => {
    if (electoralMode !== 'crimen' || crimenRows || crimenLoading) return;
    setCrimenLoading(true);
    fetch('/crimen_edomex.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.municipio] = row; });
        setCrimenRows(m);
      })
      .catch(err => { console.error('Error cargando crimen_edomex.json', err); setCrimenError('No se pudo cargar la capa de incidencia delictiva.'); })
      .finally(() => setCrimenLoading(false));
  }, [electoralMode, crimenRows, crimenLoading]);

  useEffect(() => {
    if ((electoralMode !== 'senado_2024' && electoralMode !== 'gubernatura_2023' && electoralMode !== 'dip_local_2024') || seccionesIndex) return;
    fetch('/secciones_index_edomex.json')
      .then(r => r.json())
      .then(setSeccionesIndex)
      .catch(err => console.error('Error cargando secciones_index_edomex.json', err));
  }, [electoralMode, seccionesIndex]);

  useEffect(() => {
    if (electoralMode !== 'gubernatura_2023' || gubernaturaRows || gubernaturaLoading) return;
    setGubernaturaLoading(true);
    fetch('/gubernatura_2023_edomex.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setGubernaturaRows(m);
      })
      .catch(err => { console.error('Error cargando gubernatura_2023_edomex.json', err); setGubernaturaError('No se pudo cargar la capa de Gubernatura 2023.'); })
      .finally(() => setGubernaturaLoading(false));
  }, [electoralMode, gubernaturaRows, gubernaturaLoading]);

  useEffect(() => {
    if (electoralMode !== 'dip_local_2024' || dipLocalRows || dipLocalLoading) return;
    setDipLocalLoading(true);
    fetch('/dip_local_2024_dl33_edomex.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setDipLocalRows(m);
      })
      .catch(err => { console.error('Error cargando dip_local_2024_dl33_edomex.json', err); setDipLocalError('No se pudo cargar la capa de Diputación Local 2024.'); })
      .finally(() => setDipLocalLoading(false));
  }, [electoralMode, dipLocalRows, dipLocalLoading]);

  useEffect(() => {
    if (electoralMode !== 'dip_local_2024' || dl33Boundary) return;
    fetch('/dl33_boundary.json')
      .then(r => r.json())
      .then(setDl33Boundary)
      .catch(err => console.error('Error cargando dl33_boundary.json', err));
  }, [electoralMode, dl33Boundary]);

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

  const toggleGrado = useCallback((grado) => {
    setGradosVisibles(prev => {
      const next = new Set(prev);
      if (next.has(grado)) next.delete(grado); else next.add(grado);
      return next;
    });
  }, []);

  const toggleCrimenGrado = useCallback((grado) => {
    setCrimenGradosVisibles(prev => {
      const next = new Set(prev);
      if (next.has(grado)) next.delete(grado); else next.add(grado);
      return next;
    });
  }, []);

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
  const dl33BoundaryPaths = useMemo(() => dl33Boundary ? parseWKT(dl33Boundary.geometry) : [], [dl33Boundary]);

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
  const gubernaturaActive = electoralMode === 'gubernatura_2023' && !!gubernaturaRows;
  const dipLocalActive = electoralMode === 'dip_local_2024' && !!dipLocalRows;
  const marginacionActive = electoralMode === 'marginacion' && !!marginacionRows;
  const participacionActive = electoralMode === 'participacion' && !!senadoRows; // reusa el fetch de Senaduría 2024 (votos_calculado)
  const crimenActive = electoralMode === 'crimen' && !!crimenRows;
  const anyThematicActive = marginacionActive || crimenActive || participacionActive;
  const anyPartyActive = electoralActive || gubernaturaActive || dipLocalActive;

  // Con Diputación Local 2024 activa, al entrar a un municipio que está
  // partido entre distritos locales (como Tecámac, DL22 y DL33) fija el
  // filtro de Distrito Local en 33 automáticamente — no basta con atenuar
  // las demás secciones, el control de filtro visible también debe reflejar
  // que solo importa el 33. Corre una sola vez por municipio cargado (no
  // pelea si el usuario luego elige "Todos" a propósito).
  useEffect(() => {
    if (dipLocalActive && distritosLocalesDelMunicipio.includes(33)) {
      setSelectedDistritoLocal(33);
    }
  }, [dipLocalActive, distritosLocalesDelMunicipio]);

  // Resuelve color temático para Distrito/Región/Municipio — estos niveles
  // ya traen los campos agregados directamente en el objeto (indice_
  // marginacion, tasa_delitos_2025, lista_nominal/votos_calculado, ganador),
  // a diferencia de Sección que necesita cruzar por MUNICIPIO/SECCION aparte
  // (ver el nivel Sección más abajo, tiene su propia resolución).
  const aggregateThematicColor = (entry, idx, granular) => {
    if (marginacionActive) {
      return (granular && entry.grado_marginacion)
        ? MARGINACION_COLOR_RAMP[entry.grado_marginacion]
        : marginacionColorForIndice(entry.indice_marginacion);
    }
    if (crimenActive) {
      if (granular) {
        const grado = crimenGradoForTasa(entry.tasa_delitos_2025);
        return grado ? CRIMEN_COLOR_RAMP[grado] : REGION_PALETTE[0];
      }
      return crimenColorForTasa(entry.tasa_delitos_2025);
    }
    if (participacionActive) {
      return participacionColor(participacionPct(entry.lista_nominal, entry.votos_calculado));
    }
    if (gubernaturaActive) return PARTY_COLORS_GUBERNATURA_2023[entry.ganador_2023] || REGION_PALETTE[0];
    if (dipLocalActive) return entry.ganador_dl33 ? PARTY_COLORS_DIP_LOCAL_2024[entry.ganador_dl33] : REGION_PALETTE[0];
    if (electoralActive) return PARTY_COLORS_SENADO_EDOMEX[entry.ganador] || REGION_PALETTE[0];
    return REGION_PALETTE[idx % REGION_PALETTE.length];
  };

  // Puntos de calor: un punto por municipio (centroide de su polígono
  // completo), pesado por severidad de marginación. No hay geometría de las
  // 6,748 secciones cargada de una sola vez (por diseño, ver notas de
  // rendimiento arriba), así que el heatmap estatal se arma a nivel
  // municipio — 125 puntos alcanzan para un degradado suave sin pedir datos
  // extra ni tocar el presupuesto de carga.
  const heatmapPoints = useMemo(() => {
    if (!marginacionActive || marginacionVista !== 'calor') return [];
    return municipiosAll
      .filter(m => m.grado_marginacion && gradosVisibles.has(m.grado_marginacion))
      .map(m => {
        const center = getPathsCenter(parseWKT(m.geometry));
        if (!center) return null;
        const weight = marginacionWeight(m.indice_marginacion);
        if (weight <= 0) return null;
        return { id: m.municipio, position: center, weight };
      })
      .filter(Boolean);
  }, [marginacionActive, marginacionVista, municipiosAll, gradosVisibles]);

  // Universo de números de sección sobre el que corre el análisis electoral,
  // según el nivel/filtro activo. Municipio/Sección usa las secciones reales
  // ya cargadas; Distrito/Región usa el índice ligero (sin geometría) para no
  // pedir los 6,748 polígonos de una sola vez.
  // Universo válido para cualquiera de las dos capas binarias (Senaduría
  // 2024 o Gubernatura 2023) — el cálculo es el mismo, solo cambia con qué
  // mapa de secciones se cruce después.
  const seccionesEnAnalisis = useMemo(() => {
    if (!anyPartyActive) return null;
    if (currentLevel >= 2) {
      let list = secciones;
      if (selectedDistritoLocal != null) list = list.filter(s => s.DISTRITO_LOCAL === selectedDistritoLocal);
      return list.map(s => s.SECCION);
    }
    if (currentLevel === 1) {
      if (!seccionesIndex) return null;
      if (viewMode === 'distrito' && selectedDistrito != null) {
        return seccionesIndex.filter(t => t[2] === selectedDistrito).map(t => t[0]);
      }
      if (viewMode === 'region' && selectedRegion != null) {
        const munis = new Set(municipiosDeRegion.map(m => m.municipio));
        return seccionesIndex.filter(t => munis.has(t[1])).map(t => t[0]);
      }
      return null;
    }
    if (!seccionesIndex) return null;
    return seccionesIndex.map(t => t[0]);
  }, [anyPartyActive, currentLevel, secciones, selectedDistritoLocal, seccionesIndex, viewMode, selectedDistrito, selectedRegion, municipiosDeRegion]);

  // Números generales del universo anterior — cuántas secciones se ganaron
  // y perdieron, y cuántos votos sumó cada lado ahí. Genérico para
  // Senaduría 2024 (MARIELA/votos_mariela|votos_priand) y Gubernatura 2023
  // (DELFINA/votos_delfina|votos_oposicion) — mismo cálculo, distinta fuente.
  const electoralAnalysis = useMemo(() => {
    const rowsMap = gubernaturaActive ? gubernaturaRows : dipLocalActive ? dipLocalRows : electoralActive ? senadoRows : null;
    if (!seccionesEnAnalisis || !rowsMap || !seccionesEnAnalisis.length) return null;
    const winKey = gubernaturaActive ? 'DELFINA' : dipLocalActive ? 'SAMUEL' : 'MARIELA';
    const leftField = gubernaturaActive ? 'votos_delfina' : dipLocalActive ? 'votos_samuel' : 'votos_mariela';
    const rightField = gubernaturaActive || dipLocalActive ? 'votos_oposicion' : 'votos_priand';
    let ganadas = 0, perdidas = 0, sinDato = 0, votosIzq = 0, votosDer = 0;
    seccionesEnAnalisis.forEach(sec => {
      const row = rowsMap[sec];
      if (!row || !row.votos_calculado) { sinDato++; return; }
      votosIzq += row[leftField];
      votosDer += row[rightField];
      if (row.ganador === winKey) ganadas++; else perdidas++;
    });
    const total = ganadas + perdidas;
    if (!total) return null;

    return {
      total, ganadas, perdidas, sinDato, votosIzq, votosDer,
      pctGanadas: Math.round((ganadas / total) * 100),
      margenGlobalPct: ((votosIzq - votosDer) / (votosIzq + votosDer)) * 100,
    };
  }, [seccionesEnAnalisis, senadoRows, gubernaturaRows, dipLocalRows, electoralActive, gubernaturaActive, dipLocalActive]);

  const electoralAnalysisScope = currentLevel === 0
    ? 'Estado de México'
    : currentLevel === 1
      ? (viewMode === 'distrito' ? `Distrito ${selectedDistrito}` : `Región ${toTitleCase(selectedRegion || '')}`)
      : `${fixEncoding(secciones[0]?.NOMBRE_MUNICIPIO ?? '')}${selectedDistritoLocal != null ? ` · Distrito local ${selectedDistritoLocal}` : ''}`;

  // Etiquetas/colores del panel de análisis según qué capa binaria esté
  // activa — el panel en sí (ElectoralAnalysisPanel) es genérico.
  const electoralAnalysisLabels = gubernaturaActive
    ? { eleccionLabel: 'Gubernatura 2023', leftLabel: 'Delfina G.', rightLabel: 'Va por el Edoméx', leftColor: PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke, rightColor: PARTY_COLORS_GUBERNATURA_2023.OPOSICION.stroke }
    : dipLocalActive
      ? { eleccionLabel: 'Diputación Local 2024', leftLabel: 'Samuel H.', rightLabel: 'Lili Urbina', leftColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke, rightColor: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke }
      : { eleccionLabel: 'Senaduría 2024', leftLabel: 'Mariela G.', rightLabel: 'PRI-PAN-PRD', leftColor: PARTY_COLORS_SENADO_EDOMEX.MARIELA.stroke, rightColor: PARTY_COLORS_SENADO_EDOMEX.PRIAND.stroke };

  // Desglose por municipio del Distrito Local 33 — a diferencia de
  // Senaduría/Gubernatura (estatales, se recorren navegando el mapa), esta
  // capa solo cubre 6 municipios: caben completos en una tabla fija, sin
  // necesidad de hacer drill-down para ver "ganadas/perdidas por municipio".
  const dipLocalPorMunicipio = useMemo(() => {
    if (!dipLocalActive || !dipLocalRows) return null;
    const acc = {};
    Object.values(dipLocalRows).forEach(row => {
      if (!acc[row.municipio]) acc[row.municipio] = { municipio: row.municipio, samuel: 0, oposicion: 0, ganadas: 0, perdidas: 0, secciones: 0 };
      const a = acc[row.municipio];
      a.samuel += row.votos_samuel;
      a.oposicion += row.votos_oposicion;
      a.secciones += 1;
      if (row.ganador === 'SAMUEL') a.ganadas++; else a.perdidas++;
    });
    return Object.values(acc)
      .map(a => ({ ...a, nombre: municipiosIndex.find(m => m.municipio === a.municipio)?.nombre, ganador: a.samuel >= a.oposicion ? 'SAMUEL' : 'OPOSICION' }))
      .sort((a, b) => (b.samuel + b.oposicion) - (a.samuel + a.oposicion));
  }, [dipLocalActive, dipLocalRows, municipiosIndex]);

  // Totales del propio Distrito 33 (no del estado) — esta elección no es
  // estatal, así que la tarjeta de resumen debe hablar del distrito, no del
  // Estado de México completo.
  const dipLocalTotales = useMemo(() => {
    if (!dipLocalActive || !dipLocalRows) return null;
    const rows = Object.values(dipLocalRows);
    return {
      lista_nominal: rows.reduce((s, r) => s + (r.lista_nominal || 0), 0),
      secciones: rows.length,
      municipios: new Set(rows.map(r => r.municipio)).size,
    };
  }, [dipLocalActive, dipLocalRows]);

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
    } else if (dipLocalActive) {
      // Elección no estatal — encuadra en el contorno real del Distrito
      // Local 33 (unión de sus 134 secciones), no en el Estado completo ni
      // en el contorno de los municipios que toca (varios, como Tecámac,
      // están partidos entre dos distritos locales y se verían de más).
      if (dl33Boundary) extend(dl33Boundary.geometry);
      else municipiosAll.filter(m => DL33_MUNICIPIOS.includes(m.municipio)).forEach(m => extend(m.geometry));
    } else if (estado) {
      extend(estado.geometry);
    }
    if (has) mapRef.current.fitBounds(bounds, selectedSeccion != null ? 80 : 28);
  }, [selectedSeccion, selectedMunicipio, secciones, selectedDistrito, selectedRegion, viewMode, distritos, regiones, estado, dipLocalActive, municipiosAll, dl33Boundary]);

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

  // Participación real del municipio: suma votos_calculado de sus secciones
  // (no el valor precalculado del JSON agregado, que puede desalinearse tras
  // filtros de distrito local) sobre su lista nominal real.
  const municipioParticipacionPct = useMemo(() => {
    if (!participacionActive || !secciones.length || !senadoRows) return null;
    const totalVotos = secciones.reduce((s, sec) => s + (senadoRows[sec.SECCION]?.votos_calculado || 0), 0);
    return participacionPct(totalListaNominalMunicipio, totalVotos);
  }, [participacionActive, secciones, senadoRows, totalListaNominalMunicipio]);

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

          {/* Controles de la capa de marginación: vista + filtro por grado.
              Vive fuera de los paneles por nivel para que no desaparezca al
              cambiar de Estado a Distrito a Municipio — es un ajuste de la
              capa, no del nivel de análisis. */}
          {marginacionActive && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-900">Vista</p>
                <div className="flex gap-0.5 bg-white rounded-md p-0.5 border border-amber-200">
                  <button
                    onClick={() => setMarginacionVista('calor')}
                    className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
                    style={marginacionVista === 'calor' ? { backgroundColor: '#B45309', color: '#fff' } : { color: '#92400E' }}
                  >
                    🔥 Calor
                  </button>
                  <button
                    onClick={() => setMarginacionVista('coropletas')}
                    className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
                    style={marginacionVista === 'coropletas' ? { backgroundColor: '#B45309', color: '#fff' } : { color: '#92400E' }}
                  >
                    ▦ Coropletas
                  </button>
                </div>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-900 mb-1.5">Filtrar por grado</p>
              <div className="flex flex-wrap gap-1.5">
                {MARGINACION_GRADOS_PRESENTES.map(g => {
                  const active = gradosVisibles.has(g);
                  const c = MARGINACION_COLOR_RAMP[g];
                  const darkText = g === 'Muy bajo' || g === 'Bajo' || g === 'Medio';
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGrado(g)}
                      className="px-2 py-1 rounded-full text-[10px] font-semibold border transition-all"
                      style={active
                        ? { backgroundColor: c.fill, borderColor: c.stroke, color: darkText ? '#451A03' : '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#E2E8F0', color: '#CBD5E1' }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              {gradosVisibles.size < MARGINACION_GRADOS_PRESENTES.length && (
                <button onClick={() => setGradosVisibles(new Set(MARGINACION_GRADOS_PRESENTES))} className="text-[10px] font-medium mt-1.5 hover:underline" style={{ color: '#92400E' }}>
                  Mostrar todos
                </button>
              )}
            </div>
          )}

          {/* Controles de la capa de incidencia delictiva: filtro por grado
              (cuartiles reales de la tasa estatal). Set propio — 'Muy alto'
              no existe en la escala de marginación y viceversa. */}
          {crimenActive && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-red-900 mb-1.5">Filtrar por nivel de incidencia</p>
              <div className="flex flex-wrap gap-1.5">
                {CRIMEN_GRADOS.map(g => {
                  const active = crimenGradosVisibles.has(g);
                  const c = CRIMEN_COLOR_RAMP[g];
                  const darkText = g === 'Bajo';
                  return (
                    <button
                      key={g}
                      onClick={() => toggleCrimenGrado(g)}
                      className="px-2 py-1 rounded-full text-[10px] font-semibold border transition-all"
                      style={active
                        ? { backgroundColor: c.fill, borderColor: c.stroke, color: darkText ? '#450A0A' : '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#E2E8F0', color: '#CBD5E1' }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              {crimenGradosVisibles.size < CRIMEN_GRADOS.length && (
                <button onClick={() => setCrimenGradosVisibles(new Set(CRIMEN_GRADOS))} className="text-[10px] font-medium mt-1.5 hover:underline" style={{ color: '#991B1B' }}>
                  Mostrar todos
                </button>
              )}
              <p className="text-[9px] text-red-900/50 mt-1.5 leading-snug">Cuartiles calculados sobre la tasa estatal de 125 municipios (SESNSP, dic. 2025).</p>
            </div>
          )}

          {/* Desglose fijo por municipio del Distrito Local 33 — solo son 6,
              caben completos sin necesidad de navegar el mapa uno por uno. */}
          {dipLocalActive && dipLocalPorMunicipio && (
            <DipLocal33Breakdown
              municipios={dipLocalPorMunicipio}
              onSelectMunicipio={(municipioId) => {
                const m = municipiosIndex.find(x => x.municipio === municipioId);
                if (m) handleQuickJump(m);
              }}
            />
          )}

          {/* Análisis político dinámico — Senaduría 2024, Gubernatura 2023 o
              Diputación Local 2024, la que esté activa. Se recalcula según
              el nivel/filtro activo (Estado, Distrito/Región, Municipio, y
              respeta el filtro de Distrito Local). */}
          {anyPartyActive && (
            electoralAnalysis ? (
              <ElectoralAnalysisPanel
                analysis={electoralAnalysis}
                title={electoralAnalysisScope}
                {...electoralAnalysisLabels}
              />
            ) : currentLevel < 2 && !seccionesIndex ? (
              <div className="rounded-xl border p-3 flex items-center gap-2 text-[11px] text-slate-400" style={{ borderColor: '#F0C6D0' }}>
                <div className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#F0C6D0', borderTopColor: GUINDA }} />
                Cargando análisis electoral…
              </div>
            ) : null
          )}

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
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">{dipLocalActive ? 'Distrito Local 33' : 'Estado de México'}</p>
                <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight">{fmt(dipLocalActive && dipLocalTotales ? dipLocalTotales.lista_nominal : estado.lista_nominal)}</p>
                <p className="text-[11px] opacity-70 mt-1">
                  {dipLocalActive && dipLocalTotales
                    ? `lista nominal · ${dipLocalTotales.municipios} municipios · ${dipLocalTotales.secciones} secciones`
                    : `lista nominal · ${estado.municipios} municipios · ${estado.secciones} secciones`}
                </p>
                {estadoVotos && <VoteSummary mariela={estadoVotos.mariela} priand={estadoVotos.priand} dark />}
                {estadoVotos && <TerritorialStats chalecos={estadoVotos.chalecos} lonas={estadoVotos.lonas} promotores={estadoVotos.promotores} dark />}
                {gubernaturaActive && (
                  <VoteSummary
                    mariela={estado.votos_delfina_2023} priand={estado.votos_oposicion_2023} dark
                    leftLabel="Delfina" rightLabel="Va por el Edoméx"
                  />
                )}
                {dipLocalActive && estado.votos_calculado_dl33 > 0 && (
                  <VoteSummary
                    mariela={estado.votos_samuel_dl33} priand={estado.votos_oposicion_dl33} dark
                    leftLabel="Samuel" rightLabel="Lili Urbina"
                  />
                )}
                {!dipLocalActive && <CoverageBadge pct={estado.cobertura_responsables} dark />}
                {marginacionActive && <MarginacionSummary indice={estado.indice_marginacion} dark />}
                {participacionActive && <ParticipacionSummary pct={participacionPct(estado.lista_nominal, estado.votos_calculado)} dark />}
                {crimenActive && <CrimenSummary tasa={estado.tasa_delitos_2025} poblacion={estado.poblacion} dark />}
              </div>

              {dipLocalActive ? (
                <p className="text-[10px] text-slate-400 mt-3 leading-snug">Esta elección solo cubre el Distrito Local 33 — usa la tabla de municipios de abajo para navegar, no el selector de Distrito Federal/Región (esos son estatales y no aplican aquí).</p>
              ) : (
                <>
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
              </>
              )}
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
                  {gubernaturaActive && (
                    <VoteSummary
                      mariela={selectedRegionData.votos_delfina_2023} priand={selectedRegionData.votos_oposicion_2023}
                      leftLabel="Delfina" rightLabel="Va por el Edoméx"
                    />
                  )}
                  {dipLocalActive && selectedRegionData.votos_calculado_dl33 > 0 && (
                    <VoteSummary
                      mariela={selectedRegionData.votos_samuel_dl33} priand={selectedRegionData.votos_oposicion_dl33}
                      leftLabel="Samuel" rightLabel="Lili Urbina"
                    />
                  )}
                  <CoverageBadge pct={selectedRegionData.cobertura_responsables} />
                  {marginacionActive && <MarginacionSummary indice={selectedRegionData.indice_marginacion} />}
                  {participacionActive && <ParticipacionSummary pct={participacionPct(selectedRegionData.lista_nominal, selectedRegionData.votos_calculado)} />}
                  {crimenActive && <CrimenSummary tasa={selectedRegionData.tasa_delitos_2025} poblacion={selectedRegionData.poblacion} />}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-700">{fixEncoding(selectedDistritoData.nombre_distrito_federal)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distrito {selectedDistritoData.distrito_federal} · {selectedDistritoData.secciones} secciones</p>
                  <p className="text-xl font-extrabold tabular-nums mt-1 tracking-tight" style={{ color: GUINDA }}>{fmt(selectedDistritoData.lista_nominal)} <span className="text-[10px] font-normal text-slate-400">lista nominal</span></p>
                  {electoralActive && <VoteSummary mariela={selectedDistritoData.votos_mariela} priand={selectedDistritoData.votos_priand} />}
                  {electoralActive && <TerritorialStats chalecos={selectedDistritoData.chalecos} lonas={selectedDistritoData.lonas} promotores={selectedDistritoData.promotores} />}
                  {gubernaturaActive && (
                    <VoteSummary
                      mariela={selectedDistritoData.votos_delfina_2023} priand={selectedDistritoData.votos_oposicion_2023}
                      leftLabel="Delfina" rightLabel="Va por el Edoméx"
                    />
                  )}
                  {dipLocalActive && selectedDistritoData.votos_calculado_dl33 > 0 && (
                    <VoteSummary
                      mariela={selectedDistritoData.votos_samuel_dl33} priand={selectedDistritoData.votos_oposicion_dl33}
                      leftLabel="Samuel" rightLabel="Lili Urbina"
                    />
                  )}
                  <CoverageBadge pct={selectedDistritoData.cobertura_responsables} />
                  {marginacionActive && <MarginacionSummary indice={selectedDistritoData.indice_marginacion} />}
                  {participacionActive && <ParticipacionSummary pct={participacionPct(selectedDistritoData.lista_nominal, selectedDistritoData.votos_calculado)} />}
                  {crimenActive && <CrimenSummary tasa={selectedDistritoData.tasa_delitos_2025} poblacion={selectedDistritoData.poblacion} />}
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
                      marginacion={marginacionRows?.[seccionDetalle.MUNICIPIO]}
                      crimen={crimenRows?.[seccionDetalle.MUNICIPIO]}
                      gubernatura={gubernaturaRows?.[seccionDetalle.SECCION]}
                      dipLocal={dipLocalRows?.[seccionDetalle.SECCION]}
                      onClose={() => setSelectedSeccion(null)}
                    />
                  ) : (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 mex-panel-in" key={`muni-${selectedMunicipio}`}>
                      <p className="text-xs font-bold text-slate-700">{fixEncoding(secciones[0]?.NOMBRE_MUNICIPIO ?? '')}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{secciones.length} secciones · Lista nominal {fmt(totalListaNominalMunicipio)}</p>
                      {municipioVotos && <VoteSummary mariela={municipioVotos.mariela} priand={municipioVotos.priand} />}
                      {municipioVotos && <TerritorialStats chalecos={municipioVotos.chalecos} lonas={municipioVotos.lonas} promotores={municipioVotos.promotores} />}
                      {municipioVotos && <CoverageBadge pct={municipioVotos.cobertura} />}
                      {gubernaturaActive && (() => {
                        const m = municipiosAll.find(x => x.municipio === selectedMunicipio);
                        return m ? (
                          <VoteSummary
                            mariela={m.votos_delfina_2023} priand={m.votos_oposicion_2023}
                            leftLabel="Delfina" rightLabel="Va por el Edoméx"
                          />
                        ) : null;
                      })()}
                      {dipLocalActive && (() => {
                        const m = municipiosAll.find(x => x.municipio === selectedMunicipio);
                        return m && m.votos_calculado_dl33 > 0 ? (
                          <VoteSummary
                            mariela={m.votos_samuel_dl33} priand={m.votos_oposicion_dl33}
                            leftLabel="Samuel" rightLabel="Lili Urbina"
                          />
                        ) : null;
                      })()}
                      {marginacionActive && <MarginacionDetail data={marginacionRows?.[selectedMunicipio]} />}
                      {participacionActive && <ParticipacionSummary pct={municipioParticipacionPct} />}
                      {crimenActive && <CrimenDetail data={crimenRows?.[selectedMunicipio]} />}
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

            {/* Contorno real del Distrito Local 33 — unión de sus 134
                secciones (no el de los municipios que toca), para que quede
                delimitado con precisión mientras esta capa está activa. */}
            {dipLocalActive && dl33BoundaryPaths.length > 0 && (
              <Polygon
                paths={dl33BoundaryPaths}
                options={{ fillOpacity: 0, strokeColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke, strokeWeight: 3, strokeOpacity: 0.9, clickable: false, zIndex: 4 }}
              />
            )}

            {/* Nivel Estado, vista Distrito Federal */}
            {currentLevel === 0 && viewMode === 'distrito' && distritos.map((d, i) => {
              const paths = distritosPaths[i];
              if (!paths?.length) return null;
              const heatMode = marginacionActive && marginacionVista === 'calor';
              const color = anyThematicActive || anyPartyActive
                ? aggregateThematicColor(d, i, false)
                : REGION_PALETTE[i % REGION_PALETTE.length];
              const isHovered = hoveredKey === `d${d.distrito_federal}`;
              const isFilteredOutDipLocal = dipLocalActive && !d.ganador_dl33;
              return (
                <RegionPolygon
                  key={d.distrito_federal}
                  id={d.distrito_federal}
                  paths={paths}
                  onSelectId={goToDistrito}
                  onHoverId={handleHoverDistrito}
                  fillColor={color.fill}
                  strokeColor={heatMode ? '#94A3B8' : color.stroke}
                  strokeWeight={isHovered ? 2 : 1}
                  fillOpacity={isFilteredOutDipLocal ? 0.04 : heatMode ? (isHovered ? 0.12 : 0.03) : anyThematicActive ? (isHovered ? 0.85 : 0.68) : isHovered ? 0.55 : 0.3}
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
              const heatMode = marginacionActive && marginacionVista === 'calor';
              // Excepción: a diferencia de Senaduría 2024 (Mariela gana las
              // 9 regiones, colorear por resultado las vuelve todas iguales
              // y la estructura territorial desaparece), Gubernatura 2023 sí
              // tiene variación real a nivel región (Lerma y Toluca los
              // ganó la oposición) — aquí el color por resultado sí aporta.
              const color = anyThematicActive || gubernaturaActive || dipLocalActive
                ? aggregateThematicColor(r, i, false)
                : REGION_MG_PALETTE[r.region] || REGION_PALETTE[i % REGION_PALETTE.length];
              const isHovered = hoveredKey === `reg:${r.region}`;
              const isFilteredOutDipLocal = dipLocalActive && !r.ganador_dl33;
              return (
                <RegionPolygon
                  key={r.region}
                  id={r.region}
                  paths={paths}
                  onSelectId={goToRegion}
                  onHoverId={handleHoverRegion}
                  fillColor={color.fill}
                  strokeColor={heatMode ? '#94A3B8' : color.stroke}
                  strokeWeight={isHovered ? 2 : 1}
                  fillOpacity={isFilteredOutDipLocal ? 0.04 : heatMode ? (isHovered ? 0.12 : 0.03) : anyThematicActive ? (isHovered ? 0.85 : 0.68) : isHovered ? 0.55 : 0.3}
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
              const isHovered = hoveredKey === `m${m.municipio}`;
              const mCrimenGrado = crimenActive ? crimenGradoForTasa(m.tasa_delitos_2025) : null;
              const isFilteredOut =
                (marginacionActive && m.grado_marginacion && !gradosVisibles.has(m.grado_marginacion)) ||
                (crimenActive && mCrimenGrado && !crimenGradosVisibles.has(mCrimenGrado)) ||
                (dipLocalActive && !DL33_MUNICIPIOS.includes(m.municipio));
              const color = anyThematicActive || anyPartyActive
                ? aggregateThematicColor(m, i, true)
                : REGION_PALETTE[i % REGION_PALETTE.length];
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
                  fillOpacity={isFilteredOut ? 0.04 : anyThematicActive ? (isHovered ? 0.9 : 0.75) : isHovered ? 0.55 : 0.3}
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
              const isFilteredOutLocal = selectedDistritoLocal != null && sec.DISTRITO_LOCAL !== selectedDistritoLocal;
              const seccionSenado = electoralActive ? senadoRows[sec.SECCION] : null;
              const seccionGubernatura = gubernaturaActive ? gubernaturaRows[sec.SECCION] : null;
              const seccionDipLocal = dipLocalActive ? dipLocalRows[sec.SECCION] : null;
              const seccionMarginacion = marginacionActive ? marginacionRows[sec.MUNICIPIO] : null;
              const seccionCrimen = crimenActive ? crimenRows[sec.MUNICIPIO] : null;
              const seccionCrimenGrado = seccionCrimen ? crimenGradoForTasa(seccionCrimen.tasa_delitos_2025) : null;
              const isFilteredOutGrado =
                (seccionMarginacion && !gradosVisibles.has(seccionMarginacion.grado_marginacion)) ||
                (seccionCrimenGrado && !crimenGradosVisibles.has(seccionCrimenGrado));
              // Diputación Local 2024 no es estatal — cualquier sección que
              // no pertenezca hoy al Distrito 33 (incluidas las de sus
              // propios 6 municipios que en realidad caen en otro distrito
              // local, como buena parte de Tecámac) se desfiltra igual que
              // el filtro de Distrito Local normal. Se usa DISTRITO_LOCAL
              // en vivo (tabla actual) para decidir "pertenece o no", no
              // solo si el archivo de 2024 trae su resultado — así una
              // sección nueva por partición (sin cómputo 2024 propio, p.ej.
              // 4210 en Tecámac) igual se reconoce como parte del distrito.
              const enDL33 = dipLocalActive && sec.DISTRITO_LOCAL === 33;
              const isFilteredOutDipLocal = dipLocalActive && !enDL33;
              const color = seccionMarginacion
                ? MARGINACION_COLOR_RAMP[seccionMarginacion.grado_marginacion] || marginacionColorForIndice(seccionMarginacion.indice_marginacion)
                : seccionCrimen
                  ? CRIMEN_COLOR_RAMP[seccionCrimenGrado] || crimenColorForTasa(seccionCrimen.tasa_delitos_2025)
                  : participacionActive
                    ? participacionColor(participacionPct(sec.LISTA_NOMINAL, senadoRows[sec.SECCION]?.votos_calculado))
                    : seccionGubernatura
                      ? PARTY_COLORS_GUBERNATURA_2023[seccionGubernatura.ganador] || REGION_PALETTE[0]
                      : seccionDipLocal
                        ? PARTY_COLORS_DIP_LOCAL_2024[seccionDipLocal.ganador] || REGION_PALETTE[0]
                        : enDL33
                          ? { fill: '#E2E8F0', stroke: '#94A3B8' } // en el distrito, pero sin cómputo 2024 propio (sección nueva)
                          : seccionSenado
                            ? PARTY_COLORS_SENADO_EDOMEX[seccionSenado.ganador] || REGION_PALETTE[0]
                            : distritoColorMapLocal[sec.DISTRITO_LOCAL] || REGION_PALETTE[0];
              const isThematicSeccion = !!(seccionMarginacion || seccionCrimen || participacionActive || enDL33);
              const baseOpacity = isThematicSeccion ? (isSelected ? 0.9 : isHovered ? 0.85 : 0.72) : (isSelected ? 0.85 : isHovered ? 0.6 : 0.4);
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
                  fillOpacity={(isFilteredOutLocal || isFilteredOutGrado || isFilteredOutDipLocal) ? 0.04 : baseOpacity}
                  zIndex={isSelected ? 3 : 2}
                />
              );
            })}

            {/* Mapa de calor (manchas CSS vía OverlayView, ver HeatBlob) —
                solo a nivel Estado, que es donde tiene sentido leer el
                patrón de conjunto. Al entrar a un Distrito/Región/Municipio
                se usa la coropleta de arriba, más precisa para comparar
                unidades administrativas. */}
            {currentLevel === 0 && heatmapPoints.map(p => (
              <HeatBlob key={p.id} position={p.position} weight={p.weight} />
            ))}
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
              onClick={() => setElectoralLayer('senado_2024')}
              disabled={senadoLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'senado_2024' ? { backgroundColor: GUINDA, color: '#fff' } : { color: '#4B5563' }}
              title="Resultados internos — Senaduría 2024"
            >
              {senadoLoading ? 'Cargando…' : '🗳 Senaduría 2024 · Mariela Gutiérrez'}
            </button>
            {senadoError && <p className="text-[10px] text-red-500 px-1">{senadoError}</p>}
            <button
              onClick={() => setElectoralLayer('gubernatura_2023')}
              disabled={gubernaturaLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'gubernatura_2023' ? { backgroundColor: PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke, color: '#fff' } : { color: '#4B5563' }}
              title="Cómputos definitivos IEEM — Gubernatura 2023"
            >
              {gubernaturaLoading ? 'Cargando…' : '🗳 Gubernatura 2023 · Delfina Gómez'}
            </button>
            {gubernaturaError && <p className="text-[10px] text-red-500 px-1">{gubernaturaError}</p>}
            <button
              onClick={() => setElectoralLayer('dip_local_2024')}
              disabled={dipLocalLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'dip_local_2024' ? { backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke, color: '#fff' } : { color: '#4B5563' }}
              title="Cómputos definitivos IEEM — Diputación Local, Distrito 33 (Tecámac y municipios vecinos)"
            >
              {dipLocalLoading ? 'Cargando…' : '🗳 Diputación Local 2024 · Distrito 33'}
            </button>
            {dipLocalError && <p className="text-[10px] text-red-500 px-1">{dipLocalError}</p>}
            <button
              onClick={() => setElectoralLayer('marginacion')}
              disabled={marginacionLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'marginacion' ? { backgroundColor: '#B45309', color: '#fff' } : { color: '#4B5563' }}
              title="Índice de marginación municipal — CONAPO 2020"
            >
              {marginacionLoading ? 'Cargando…' : '📊 Marginación social · CONAPO 2020'}
            </button>
            {marginacionError && <p className="text-[10px] text-red-500 px-1">{marginacionError}</p>}
            <button
              onClick={() => setElectoralLayer('participacion')}
              disabled={senadoLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'participacion' ? { backgroundColor: '#0D9488', color: '#fff' } : { color: '#4B5563' }}
              title="Participación electoral estimada — Senaduría 2024"
            >
              {senadoLoading ? 'Cargando…' : '📈 Participación electoral · 2024'}
            </button>
            <button
              onClick={() => setElectoralLayer('crimen')}
              disabled={crimenLoading}
              className="w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight disabled:opacity-60"
              style={electoralMode === 'crimen' ? { backgroundColor: '#B91C1C', color: '#fff' } : { color: '#4B5563' }}
              title="Incidencia delictiva municipal — SESNSP, dic. 2025"
            >
              {crimenLoading ? 'Cargando…' : '🚨 Incidencia delictiva · SESNSP'}
            </button>
            {crimenError && <p className="text-[10px] text-red-500 px-1">{crimenError}</p>}
          </div>
        )}

        {/* Capa de marginación activa: gradiente continuo, misma leyenda sin
            importar el nivel — reemplaza a las demás leyendas de color. */}
        {marginacionActive && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 max-w-[240px]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Marginación social · CONAPO 2020</p>
            <p className="text-[10px] text-slate-500 leading-snug mb-1.5">Mide el rezago en vivienda (agua, drenaje, hacinamiento), educación e ingreso de cada municipio.</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">Menor</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, ${MARGINACION_COLOR_RAMP['Muy bajo'].fill}, ${MARGINACION_COLOR_RAMP['Bajo'].fill}, ${MARGINACION_COLOR_RAMP['Medio'].fill}, ${MARGINACION_COLOR_RAMP['Alto'].fill})` }} />
              <span className="text-[9px] text-slate-400">Mayor</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 leading-snug">Dato oficial a nivel municipio{currentLevel >= 2 ? ' — todas las secciones de un municipio comparten color' : ''}.</p>
          </div>
        )}

        {/* Capa de participación activa: escala divergente rojo→verde. */}
        {participacionActive && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 max-w-[240px]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Participación electoral · Senaduría 2024</p>
            <p className="text-[10px] text-slate-500 leading-snug mb-1.5">Votos computados sobre la lista nominal de cada zona — estimación, no el dato oficial de participación del INE.</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">{PARTICIPACION_RANGE.min}%</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #B91C1C, #F59E0B, #65A30D, #0D9488)' }} />
              <span className="text-[9px] text-slate-400">{PARTICIPACION_RANGE.max}%+</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 leading-snug">Sección: dato real. Municipio/Distrito/Región: agregado ponderado.</p>
          </div>
        )}

        {/* Capa de incidencia delictiva activa: cuartiles de la tasa estatal. */}
        {crimenActive && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 max-w-[240px]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Incidencia delictiva · SESNSP, dic. 2025</p>
            <p className="text-[10px] text-slate-500 leading-snug mb-1.5">Carpetas de investigación del fuero común <span className="font-semibold text-slate-700">por cada 100 mil habitantes</span>, no el conteo absoluto — un municipio con más población y más delitos en números totales puede tener una tasa per cápita más baja que uno chico.</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">Menor</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, ${CRIMEN_COLOR_RAMP['Bajo'].fill}, ${CRIMEN_COLOR_RAMP['Medio'].fill}, ${CRIMEN_COLOR_RAMP['Alto'].fill}, ${CRIMEN_COLOR_RAMP['Muy alto'].fill})` }} />
              <span className="text-[9px] text-slate-400">Mayor</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 leading-snug">Dato oficial a nivel municipio{currentLevel >= 2 ? ' — todas las secciones de un municipio comparten color' : ''}. Municipios pequeños: pocos casos pueden disparar la tasa (efecto de números pequeños) — revisa la población en el detalle antes de comparar.</p>
          </div>
        )}

        {/* Nivel Estado + vista Región MG: la región es identidad territorial,
            no resultado electoral — su leyenda es de nombres, no de partidos.
            Excepción: Gubernatura 2023 sí colorea la región por resultado
            (ver aggregateThematicColor), así que ahí no aplica esta leyenda. */}
        {!anyThematicActive && !gubernaturaActive && !dipLocalActive && currentLevel === 0 && viewMode === 'region' && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 max-w-[280px]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Región MG</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {regiones.map(r => {
                const c = REGION_MG_PALETTE[r.region] || REGION_PALETTE[0];
                return (
                  <span key={r.region} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
                    <span className="text-[10px] text-slate-600">{toTitleCase(r.region)}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!anyThematicActive && electoralActive && !(currentLevel === 0 && viewMode === 'region') && (currentLevel === 0 || currentLevel === 1) && (
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

        {!anyThematicActive && gubernaturaActive && (currentLevel === 0 || currentLevel === 1) && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-1.5 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_GUBERNATURA_2023.DELFINA.fill, border: `1px solid ${PARTY_COLORS_GUBERNATURA_2023.DELFINA.stroke}` }} />
              <span className="text-[10px] text-slate-600">{PARTY_COLORS_GUBERNATURA_2023.DELFINA.label}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_GUBERNATURA_2023.OPOSICION.fill, border: `1px solid ${PARTY_COLORS_GUBERNATURA_2023.OPOSICION.stroke}` }} />
              <span className="text-[10px] text-slate-600">{PARTY_COLORS_GUBERNATURA_2023.OPOSICION.label}</span>
            </span>
          </div>
        )}

        {!anyThematicActive && dipLocalActive && (currentLevel === 0 || currentLevel === 1) && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 px-3 py-2 max-w-[260px]">
            <div className="flex items-center gap-3 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.fill, border: `1px solid ${PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.stroke}` }} />
                <span className="text-[10px] text-slate-600">{PARTY_COLORS_DIP_LOCAL_2024.SAMUEL.label}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.fill, border: `1px solid ${PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.stroke}` }} />
                <span className="text-[10px] text-slate-600">{PARTY_COLORS_DIP_LOCAL_2024.OPOSICION.label}</span>
              </span>
            </div>
            <p className="text-[9px] text-slate-400 leading-snug">Solo Distrito Local 33 (Tecámac, Teotihuacán, Temascalapa, San Martín de las Pirámides, Axapusco, Nopaltepec) — el resto del estado no pertenece a este distrito.</p>
          </div>
        )}

        {!anyThematicActive && !anyPartyActive && currentLevel >= 2 && !loadingSecciones && !seccionesError && Object.keys(distritoColorMapLocal).length > 0 && (
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
