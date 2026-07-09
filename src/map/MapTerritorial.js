import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow, OverlayView } from '@react-google-maps/api';

const GOOGLE_API_KEY = 'AIzaSyCq9lepK0chTwx6vDjQlCftmP-IpCSBuPM';
const DEFAULT_CENTER = { lat: 19.66, lng: -98.99 };

// ── Paleta de sectores ───────────────────────────────────────────────────────
const SECTOR_COLORS = [
  { fill: '#3B82F6', stroke: '#1D4ED8' },
  { fill: '#10B981', stroke: '#047857' },
  { fill: '#F59E0B', stroke: '#B45309' },
  { fill: '#EF4444', stroke: '#B91C1C' },
  { fill: '#8B5CF6', stroke: '#6D28D9' },
  { fill: '#EC4899', stroke: '#BE185D' },
  { fill: '#14B8A6', stroke: '#0F766E' },
  { fill: '#F97316', stroke: '#C2410C' },
  { fill: '#6366F1', stroke: '#4338CA' },
  { fill: '#84CC16', stroke: '#4D7C0F' },
];

// ── Color de marcador por puesto ─────────────────────────────────────────────
const PUESTO_COLOR = {
  SP:          '#7C3AED',
  SECCIONAL:   '#DB2777',
  SM:          '#2563EB',
  MOVILIZADOR: '#059669',
  INVITADO:    '#6B7280',
};
const getPuestoColor = (puesto) =>
  PUESTO_COLOR[(puesto || '').toUpperCase()] ?? '#6B7280';

// ── Estilos de mapa ──────────────────────────────────────────────────────────
const MAP_STYLE_DEFS = {
  claro: {
    label: 'Claro',
    mapTypeId: 'roadmap',
    styles: [
      { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9e0' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9c9c9' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    ],
  },
  oscuro: {
    label: 'Oscuro',
    mapTypeId: 'roadmap',
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#16213e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#8a8aaa' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#16213e' }] },
      { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a1a' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#283060' }] },
      { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#353575' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a6a' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9999cc' }] },
    ],
  },
  minimal: {
    label: 'Mínimo',
    mapTypeId: 'roadmap',
    styles: [
      { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill',   stylers: [{ visibility: 'on', color: '#888' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ visibility: 'on', color: '#fff' }] },
      { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d0e4f0' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#dddddd' }] },
    ],
  },
  satelite: {
    label: 'Satélite',
    mapTypeId: 'hybrid',
    styles: [],
  },
};

// ── WKT parser robusto ────────────────────────────────────────────────────────
const parseWKT = (wkt) => {
  if (!wkt) return [];
  const s = String(wkt).trim();
  const toPoints = (str) =>
    str.trim().split(',').map(coord => {
      const p = coord.trim().split(/\s+/);
      return { lat: Number(p[1]), lng: Number(p[0]) };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

  const groups = [];
  const rx = /\(\(([^()]+)\)\)/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const pts = toPoints(m[1]);
    if (pts.length) groups.push(pts);
  }
  if (groups.length) return groups;

  const inner = s
    .replace(/MULTIPOLYGON\s*\(\(\(/, '').replace(/\)\)\)$/, '')
    .replace(/POLYGON\s*\(\(/, '').replace(/\)\)$/, '');
  const fb = toPoints(inner);
  return fb.length ? [fb] : [];
};

const getCenter = (pathGroups) => {
  const all = pathGroups.flat();
  if (!all.length) return DEFAULT_CENTER;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
};

const fmt = (v) => (v != null && v !== '' ? Number(v).toLocaleString() : null);

// ── Print ─────────────────────────────────────────────────────────────────────

const PRINT_STYLE = `
  @media print {
    @page { size: A4 landscape; margin: 8mm 12mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body * { visibility: hidden; }
    .mp-root, .mp-root * { visibility: visible; }
    .mp-root {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      background: white !important;
      display: flex !important; flex-direction: column !important;
      z-index: 99999 !important;
    }
    .no-print { display: none !important; visibility: hidden !important; }
    .print-only { display: block !important; visibility: visible !important; }
    .print-flex { display: flex !important; visibility: visible !important; }
  }
  .print-only, .print-flex { display: none; }
`;

const PrintHeader = ({ ctx }) => {
  const dt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="print-flex" style={{
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #0f2a4a 0%, #1d4ed8 100%)',
      color: '#fff',
      borderBottom: '3px solid #f59e0b',
    }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1.1 }}>
          Tablero Territorial
          {ctx?.levelValue && (
            <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 500, opacity: .75, letterSpacing: '.04em' }}>
              · {ctx.levelValue}
            </span>
          )}
        </div>
        {ctx?.breadcrumb && (
          <div style={{ fontSize: 10, marginTop: 3, opacity: .65, letterSpacing: '.03em' }}>{ctx.breadcrumb}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: .9 }}>{dt}</div>
        <div style={{ fontSize: 9, marginTop: 2, opacity: .6, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          Informe operativo de campo
        </div>
      </div>
    </div>
  );
};

const PrintFooter = ({ ctx }) => {
  if (!ctx) return null;
  const afPct = ctx.afiliados && ctx.credenciales
    ? `${((ctx.credenciales / ctx.afiliados) * 100).toFixed(0)}%`
    : null;
  const items = [
    { label: 'Lista Nominal', value: Number(ctx.listaNominal || 0).toLocaleString('es-MX'), accent: '#1d4ed8' },
    { label: 'Secciones', value: ctx.secciones },
    ctx.ubicados   && { label: 'Ubicados', value: ctx.ubicados },
    ctx.promotores && { label: 'Promotores SM', value: ctx.promotores, accent: '#2563eb' },
    ctx.fracciones && { label: 'Fracciones', value: ctx.fracciones },
    ctx.afiliados  && { label: 'Afiliados', value: Number(ctx.afiliados).toLocaleString('es-MX'), accent: '#0f766e' },
    ctx.credenciales && {
      label: 'Credenciales entregadas',
      value: `${Number(ctx.credenciales).toLocaleString('es-MX')}${afPct ? ` · ${afPct}` : ''}`,
      accent: '#0f766e',
    },
  ].filter(Boolean);

  return (
    <div className="print-only" style={{ flexShrink: 0, background: '#f8fafc', borderTop: '2px solid #e2e8f0', padding: '7px 16px' }}>
      <div className="print-flex" style={{ gap: 22, marginBottom: 5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#64748b', lineHeight: 1 }}>{it.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: it.accent ?? '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, marginTop: 2 }}>{it.value}</div>
          </div>
        ))}
      </div>
      <div className="print-flex" style={{ justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 3 }}>
        <div style={{ fontSize: 9, color: '#475569' }}>
          {ctx.sp && <span><strong>Coordinador SP:</strong> {ctx.sp}</span>}
          {ctx.sp && ctx.seccional && <span style={{ margin: '0 10px', color: '#cbd5e1' }}>|</span>}
          {ctx.seccional && <span><strong>Seccional RS:</strong> {ctx.seccional}</span>}
        </div>
        <div style={{ fontSize: 8, color: '#94a3b8' }}>
          Documento informativo para operaciones en campo · Sistema de Gestión Electoral
        </div>
      </div>
    </div>
  );
};

// ── Tooltip de hover ──────────────────────────────────────────────────────────
const GenderBar = ({ total, hombres, mujeres, noBinario, sub, isDark }) => {
  if (!total || (!hombres && !mujeres)) return null;
  const pct = (n) => n ? `${((n / total) * 100).toFixed(1)}%` : null;
  const nb = noBinario || 0;
  return (
    <div className="mt-1.5">
      <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
        {hombres  && <div className="h-full bg-blue-400"   style={{ width: `${(hombres  / total) * 100}%` }} />}
        {mujeres  && <div className="h-full bg-pink-400"   style={{ width: `${(mujeres  / total) * 100}%` }} />}
        {nb > 0   && <div className="h-full bg-violet-400" style={{ width: `${(nb / total) * 100}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1">
        {hombres  && <span className={`text-xs ${sub}`}>♂ {Number(hombres).toLocaleString()} <span className="opacity-60">({pct(hombres)})</span></span>}
        {mujeres  && <span className={`text-xs ${sub}`}>♀ {Number(mujeres).toLocaleString()} <span className="opacity-60">({pct(mujeres)})</span></span>}
        {nb > 0   && <span className={`text-xs ${sub}`}>⚧ {Number(nb).toLocaleString()} <span className="opacity-60">({pct(nb)})</span></span>}
      </div>
    </div>
  );
};

const HoverTooltip = ({ data, pos, containerRef, isDark, tipo = 'seccion', seccional, sp, sms = [], afil = null }) => {
  if (!data || !containerRef.current) return null;

  const containerW = containerRef.current.offsetWidth;
  const containerH = containerRef.current.offsetHeight;
  const tooltipW   = 268;
  const tooltipH   = tipo === 'fraccion' ? 170 : sms.length > 0 ? (afil ? 440 : 400) : (afil ? 370 : 330);

  const flipX = pos.x + tooltipW + 20 > containerW;
  const flipY = pos.y + tooltipH + 10 > containerH;

  const style = {
    position: 'absolute',
    left:  flipX ? pos.x - tooltipW - 12 : pos.x + 14,
    top:   flipY ? pos.y - tooltipH - 10 : pos.y + 10,
    pointerEvents: 'none',
    zIndex: 50,
    width: tooltipW,
  };

  const bg    = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const title = isDark ? 'text-white'   : 'text-gray-900';
  const sub   = isDark ? 'text-gray-400' : 'text-gray-500';
  const val   = isDark ? 'text-gray-100' : 'text-gray-800';
  const divider = isDark ? 'border-gray-700' : 'border-gray-100';

  const Row = ({ label, value, accent }) => {
    if (value == null) return null;
    return (
      <div className="flex justify-between items-center gap-2 py-0.5">
        <span className={`text-xs ${sub}`}>{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${accent ? 'text-blue-500' : val}`}>{value}</span>
      </div>
    );
  };

  if (tipo === 'fraccion') {
    const smName = data.sm
      ? [data.sm.nombre, data.sm.a_paterno, data.sm.a_materno].filter(Boolean).join(' ')
      : null;
    const smLat = Number(data.sm?.latitud);
    const smLng = Number(data.sm?.longitud);
    const smHasCoords = data.sm && data.sm.latitud && !isNaN(smLat) && smLat !== 0;
    const statusColor = smHasCoords
      ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
      : data.sm
        ? (isDark ? 'text-blue-400' : 'text-blue-600')
        : (isDark ? 'text-amber-400' : 'text-amber-600');
    const statusLabel = smHasCoords ? '📍 SM ubicada' : data.sm ? '● SM sin ubicación' : '⚠ Sin SM asignada';

    return (
      <div style={style} className={`rounded-xl border shadow-2xl p-3 ${bg}`}>
        <div className={`mb-2 pb-2 border-b ${divider} flex items-start justify-between gap-2`}>
          <p className={`text-sm font-bold ${title}`}>Fracción {data.fraccion}</p>
          <span className={`text-xs font-semibold ${statusColor} flex-shrink-0`}>{statusLabel}</span>
        </div>
        <div className="space-y-0.5">
          <Row label="Sección"     value={data.seccion} />
          <Row label="Promotor SM" value={smName || '—'} />
          {data.sm?.telefono_1 && <Row label="Teléfono" value={data.sm.telefono_1} />}
        </div>
      </div>
    );
  }

  // Datos electorales de la sección
  const listaNominal     = data.lista_nominal;
  const padronTotal      = data.padron ?? data.padron_electoral;
  const nombreDistrito   = data.nombre_distrito_federal;
  const padronH          = data.padron_hombres;
  const padronM          = data.padron_mujeres;
  const padronNB         = data.padron_no_binario;
  const listaNomH        = data.hombres ?? data.total_hombres;
  const listaNomM        = data.mujeres ?? data.total_mujeres;

  return (
    <div style={style} className={`rounded-xl border shadow-2xl p-3 ${bg}`}>

      {/* Encabezado */}
      <div className={`mb-2 pb-2 border-b ${divider}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-sm font-bold leading-tight ${title}`}>Sección {data.seccion}</p>
            <p className={`text-xs ${sub} mt-0.5`}>Sector {data.pologono}</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium flex-shrink-0 mt-0.5">
            Dto. {data.distrito_federal}
          </span>
        </div>
        {nombreDistrito && (
          <p className={`text-xs ${val} font-medium mt-1`}>{nombreDistrito}</p>
        )}
      </div>

      {/* Lista nominal */}
      <div className="space-y-0.5">
        <Row label="Lista nominal"    value={listaNominal != null ? Number(listaNominal).toLocaleString() : null} accent />
        <Row label="Padrón electoral" value={padronTotal  != null ? Number(padronTotal).toLocaleString()  : null} />
      </div>

      {/* Barra lista nominal (hombres/mujeres) */}
      {(listaNomH || listaNomM) && (
        <div className={`mt-2 pt-2 border-t ${divider}`}>
          <p className={`text-xs font-medium ${sub} mb-1`}>Lista nominal por género</p>
          <GenderBar total={listaNominal} hombres={listaNomH} mujeres={listaNomM} sub={sub} isDark={isDark} />
        </div>
      )}

      {/* Padrón desglosado */}
      {(padronH || padronM) && (
        <div className={`mt-2 pt-2 border-t ${divider}`}>
          <p className={`text-xs font-medium ${sub} mb-1`}>Padrón por género</p>
          <GenderBar total={padronTotal} hombres={padronH} mujeres={padronM} noBinario={padronNB} sub={sub} isDark={isDark} />
        </div>
      )}

      {/* Responsables (solo si disponibles) */}
      {(sp || seccional) && (
        <div className={`mt-2 pt-2 border-t ${divider} space-y-0.5`}>
          {sp       && <Row label="Coordinador SP" value={sp} />}
          {seccional && <Row label="Seccional RS"  value={seccional} />}
        </div>
      )}

      {/* SMs ubicados */}
      <div className={`mt-2 pt-2 border-t ${divider}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-semibold ${sub}`}>Promotores SM</span>
          <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
            isDark ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700'
          }`}>
            {sms.length > 0 ? sms.length : '—'}
          </span>
        </div>
        {sms.length > 0 && (
          <div className="space-y-0.5 max-h-[72px] overflow-y-auto">
            {sms.map((c, i) => (
              <p key={i} className={`text-xs truncate ${val}`}>
                {[c.nombre, c.a_paterno, c.a_materno].filter(Boolean).join(' ')}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Afiliación (discreto) */}
      {afil && (
        <div className={`mt-2 pt-1.5 border-t ${divider}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold ${sub}`}>Afiliación</span>
            <span className={`text-[10px] tabular-nums font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              {afil.credenciales_entregadas}<span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/{afil.afiliados}</span>
              <span className={`ml-1 ${isDark ? 'text-teal-500' : 'text-teal-500'}`}>
                {afil.afiliados ? `${((afil.credenciales_entregadas / afil.afiliados) * 100).toFixed(0)}%` : '—'}
              </span>
            </span>
          </div>
          <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div
              className="h-full bg-teal-500 rounded-full"
              style={{ width: afil.afiliados ? `${Math.min((afil.credenciales_entregadas / afil.afiliados) * 100, 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}

      <p className={`text-xs mt-2 pt-1.5 border-t ${divider} ${sub}`}>
        Clic para seleccionar sección
      </p>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const MapTerritorial = ({
  secciones = [],
  ciudadanos = [],
  fraccionesGeo = [],
  selectedSeccion,
  onSelectSeccion,
  seccionalName = null,
  spName = null,
  focusCoords = null,
  onClearFocus,
  afiliacionBySec = {},
  printContext = null,
}) => {
  const mapRef        = useRef(null);
  const containerRef  = useRef(null);

  const [activeMarker,    setActiveMarker]    = useState(null);
  const [sectorColorMap,  setSectorColorMap]  = useState({});
  const [currentStyle,    setCurrentStyle]    = useState('claro');
  const [hovered,         setHovered]         = useState(null);  // { data, tipo }
  const [tooltipPos,      setTooltipPos]      = useState({ x: 0, y: 0 });

  const isDark     = currentStyle === 'oscuro';
  const styleDef   = MAP_STYLE_DEFS[currentStyle];

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_API_KEY });

  // Color por sector
  useEffect(() => {
    const map = {};
    const sectors = [...new Set(secciones.map(s => s.pologono))].sort((a, b) => a - b);
    sectors.forEach((s, i) => { map[s] = SECTOR_COLORS[i % SECTOR_COLORS.length]; });
    setSectorColorMap(map);
  }, [secciones]);

  // Auto-fit al cambiar secciones visibles
  useEffect(() => {
    if (!mapRef.current || !secciones.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let has = false;
    secciones.forEach(sec => {
      parseWKT(sec.geometry).flat().forEach(p => { bounds.extend(p); has = true; });
    });
    if (has) mapRef.current.fitBounds(bounds, 32);
  }, [secciones]);

  useEffect(() => { setActiveMarker(null); setHovered(null); }, [selectedSeccion]);

  // Pan + zoom al enfocar una SM
  useEffect(() => {
    if (!focusCoords || !mapRef.current || !window.google) return;
    mapRef.current.panTo({ lat: focusCoords.lat, lng: focusCoords.lng });
    mapRef.current.setZoom(17);
  }, [focusCoords]);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Inject print CSS once on mount
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'map-print-style';
    el.textContent = PRINT_STYLE;
    document.head.appendChild(el);
    return () => document.getElementById('map-print-style')?.remove();
  }, []);

  // Seguimiento de mouse sobre el contenedor del mapa
  const handleContainerMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Handlers de polígono
  const onPolyMouseOver = useCallback((sec) => {
    const smsInSec = ciudadanos.filter(c =>
      c.puesto?.toUpperCase() === 'SM' &&
      Number(c.seccion) === Number(sec.seccion)
    );
    setHovered({ data: sec, tipo: 'seccion', sms: smsInSec });
  }, [ciudadanos]);

  const onPolyMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.domEvent.clientX - rect.left, y: e.domEvent.clientY - rect.top });
  }, []);

  const onPolyMouseOut = useCallback(() => setHovered(null), []);

  const onFracMouseOver = useCallback((c) => {
    setHovered({ data: c, tipo: 'fraccion' });
  }, []);

  const markerIcon = useCallback((puesto) => {
    if (!window.google) return undefined;
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: getPuestoColor(puesto),
      fillOpacity: 0.92,
      strokeColor: isDark ? '#1a1a1a' : '#ffffff',
      strokeWeight: 2,
    };
  }, [isDark]);

  if (!isLoaded) return (
    <div className="flex items-center justify-center bg-gray-100 rounded-xl h-full min-h-[400px]">
      <p className="text-gray-400 text-sm">Cargando mapa...</p>
    </div>
  );

  const markers = ciudadanos.filter(c =>
    c.latitud && c.longitud && !isNaN(Number(c.latitud)) && !isNaN(Number(c.longitud)) &&
    Number(c.latitud) !== 0 && Number(c.longitud) !== 0 &&
    !(focusCoords &&
      Number(c.latitud) === focusCoords.lat &&
      Number(c.longitud) === focusCoords.lng)
  );

  // Colores por estado de asignación de fracción
  const fracColor = (f) => {
    const lat = Number(f.sm?.latitud);
    const lng = Number(f.sm?.longitud);
    const smHasCoords = f.sm && f.sm.latitud && f.sm.longitud &&
      !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    if (smHasCoords)  return { fill: '#10B981', stroke: '#059669' }; // SM ubicada
    if (f.sm)         return { fill: '#3B82F6', stroke: '#1D4ED8' }; // SM sin coords
    return              { fill: '#F59E0B', stroke: '#D97706' };       // sin SM
  };

  return (
    <div className="mp-root flex flex-col h-full">
      <PrintHeader ctx={printContext} />

      <div className="flex flex-col flex-1 overflow-hidden rounded-xl shadow-lg border border-gray-200">

      {/* ── Área del mapa ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[400px]"
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Selector de capa flotante */}
        <div className="no-print absolute top-3 left-3 z-10 flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-200">
          {Object.entries(MAP_STYLE_DEFS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setCurrentStyle(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentStyle === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>

        {/* Botón imprimir PDF */}
        <button
          onClick={() => window.print()}
          className="no-print absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M4 6V2h8v4M4 12H2a1 1 0 01-1-1V6.5a1 1 0 011-1h12a1 1 0 011 1V11a1 1 0 01-1 1h-2M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Imprimir PDF
        </button>

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={DEFAULT_CENTER}
          zoom={11}
          onLoad={onLoad}
          options={{
            mapTypeId: styleDef.mapTypeId,
            styles: styleDef.styles,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
          }}
        >
          {/* ── Polígonos de secciones ──────────────────────────────── */}
          {(() => {
            // Solo ceder el protagonismo a las fracciones si hay geometrías reales
            const hasFracGeom = fraccionesGeo.some(
              f => f.geometry && parseWKT(f.geometry).length > 0
            );
            return secciones.map((sec, idx) => {
              const paths      = parseWKT(sec.geometry);
              if (!paths.length) return null;
              const color      = sectorColorMap[sec.pologono] || SECTOR_COLORS[0];
              const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;
              // Modo "fondo": seleccionada Y con fracciones mapeadas
              const isBg       = isSelected && hasFracGeom;
              const isHovered  = hovered?.tipo === 'seccion' && hovered?.data?.seccion === sec.seccion;

              return (
                <React.Fragment key={sec.id ?? idx}>
                  {paths.map((ring, ri) => (
                    <Polygon
                      key={`sec-${sec.id}-${ri}`}
                      paths={ring}
                      onMouseOver={isBg ? undefined : () => onPolyMouseOver(sec)}
                      onMouseMove={isBg ? undefined : onPolyMouseMove}
                      onMouseOut={isBg ? undefined : onPolyMouseOut}
                      onClick={isBg ? undefined : () => onSelectSeccion?.(sec)}
                      options={{
                        fillColor:    isSelected ? '#FBBF24' : color.fill,
                        strokeColor:  isSelected ? '#B45309' : isHovered ? '#1e1e1e' : color.stroke,
                        fillOpacity:  isBg ? 0.05 : isSelected ? 0.75 : isHovered ? 0.65 : isDark ? 0.50 : 0.38,
                        strokeWeight: isBg ? 3    : isSelected ? 3    : isHovered ? 2.5 : 1.5,
                        zIndex:       isBg ? 1    : isSelected ? 20   : isHovered ? 10  : 2,
                        clickable:    !isBg,
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            });
          })()}

          {/* ── Etiquetas de sección (watermark) ───────────────────── */}
          {secciones.map((sec, idx) => {
            const paths = parseWKT(sec.geometry);
            if (!paths.length) return null;
            const center = getCenter(paths);
            const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;
            return (
              <OverlayView
                key={`lbl-sec-${sec.id ?? idx}`}
                position={center}
                mapPaneName="overlayMouseTarget"
              >
                <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                    letterSpacing: '.03em',
                    lineHeight: 1.35,
                    whiteSpace: 'nowrap',
                    padding: '1.5px 4px',
                    borderRadius: 3,
                    color: isSelected
                      ? '#78350f'
                      : isDark ? 'rgba(248,250,252,0.85)' : 'rgba(15,23,42,0.72)',
                    background: isSelected
                      ? 'rgba(251,191,36,0.75)'
                      : isDark ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.72)',
                    border: isSelected
                      ? '0.5px solid rgba(120,53,15,0.4)'
                      : isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
                  }}>
                    {sec.seccion}
                  </span>
                </div>
              </OverlayView>
            );
          })}

          {/* ── Polígonos de fracciones (desde tabla fracciones) ───── */}
          {fraccionesGeo.map((f) => {
            const paths = parseWKT(f.geometry);
            if (!paths.length) return null;
            const { fill, stroke } = fracColor(f);
            const isFocused = focusCoords?.ubt === f.fraccion;
            const isHovered = hovered?.tipo === 'fraccion' && hovered?.data?.fraccion === f.fraccion;
            return (
              <React.Fragment key={`frac-${f.fraccion}`}>
                {paths.map((ring, ri) => (
                  <Polygon
                    key={`frac-${f.fraccion}-${ri}`}
                    paths={ring}
                    onMouseOver={() => onFracMouseOver(f)}
                    onMouseMove={onPolyMouseMove}
                    onMouseOut={onPolyMouseOut}
                    options={{
                      fillColor:    fill,
                      strokeColor:  isFocused ? '#92400E' : isHovered ? '#111827' : stroke,
                      fillOpacity:  isFocused ? 0.65 : isHovered ? 0.70 : 0.48,
                      strokeWeight: isFocused ? 3.5  : isHovered ? 3    : 2.2,
                      strokeOpacity: 1,
                      zIndex:       isFocused ? 30   : isHovered ? 25   : 12,
                    }}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* ── Etiquetas de fracción ───────────────────────────────── */}
          {fraccionesGeo.map((f) => {
            const paths = parseWKT(f.geometry);
            if (!paths.length) return null;
            const center  = getCenter(paths);
            const { fill } = fracColor(f);
            const smName  = f.sm
              ? [f.sm.nombre, f.sm.a_paterno].filter(Boolean).join(' ')
              : null;
            return (
              <OverlayView
                key={`lbl-frac-${f.fraccion}`}
                position={center}
                mapPaneName="overlayMouseTarget"
              >
                <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none', textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                  }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      letterSpacing: '.04em',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      padding: '1.5px 5px',
                      borderRadius: 4,
                      color: '#fff',
                      background: fill + 'cc',
                      border: '0.5px solid rgba(0,0,0,0.15)',
                    }}>
                      F-{f.fraccion}
                    </span>
                    {smName && (
                      <span style={{
                        fontSize: 8,
                        fontWeight: 600,
                        fontFamily: 'system-ui,-apple-system,sans-serif',
                        whiteSpace: 'nowrap',
                        padding: '1px 4px',
                        borderRadius: 3,
                        color: isDark ? 'rgba(248,250,252,0.8)' : 'rgba(15,23,42,0.65)',
                        background: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.78)',
                        border: isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.08)',
                        maxWidth: 80,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {smName}
                      </span>
                    )}
                  </div>
                </div>
              </OverlayView>
            );
          })}

          {/* ── Marcadores ciudadanos ────────────────────────────────── */}
          {markers.map((c) => (
            <Marker
              key={`mk-${c.id}`}
              position={{ lat: Number(c.latitud), lng: Number(c.longitud) }}
              icon={markerIcon(c.puesto)}
              onClick={() => setActiveMarker(activeMarker?.id === c.id ? null : c)}
              zIndex={30}
            >
              {activeMarker?.id === c.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div className="font-sans text-gray-800 text-xs min-w-[160px]">
                    <p className="font-bold text-sm mb-0.5">
                      {[c.nombre, c.a_paterno, c.a_materno].filter(Boolean).join(' ')}
                    </p>
                    {c.puesto && (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-white text-xs font-medium mb-1"
                        style={{ backgroundColor: getPuestoColor(c.puesto) }}
                      >
                        {c.puesto}
                      </span>
                    )}
                    {c.ubt     && <p className="text-gray-500">Fracción: <span className="font-medium text-gray-700">{c.ubt}</span></p>}
                    {c.seccion && <p className="text-gray-500">Sección: <span className="font-medium text-gray-700">{c.seccion}</span></p>}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}

          {/* ── Marcador de enfoque SM seleccionada ─────────────────── */}
          {focusCoords && window.google && (
            <Marker
              position={{ lat: focusCoords.lat, lng: focusCoords.lng }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 16,
                fillColor: '#F59E0B',
                fillOpacity: 0.85,
                strokeColor: '#92400E',
                strokeWeight: 3,
              }}
              zIndex={50}
              onClick={() => onClearFocus?.()}
            />
          )}
        </GoogleMap>

        {/* ── Tooltip dinámico de hover ───────────────────────────────── */}
        {hovered && (
          <HoverTooltip
            data={hovered.data}
            tipo={hovered.tipo}
            pos={tooltipPos}
            containerRef={containerRef}
            isDark={isDark}
            seccional={hovered.data?.seccion === selectedSeccion ? seccionalName : null}
            sp={spName}
            sms={hovered.sms ?? []}
            afil={hovered.tipo === 'seccion' ? afiliacionBySec[hovered.data?.seccion] : null}
          />
        )}
      </div>

      {/* ── Pie: leyenda ────────────────────────────────────────────────── */}
      <div className={`no-print flex-shrink-0 px-4 py-2.5 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(sectorColorMap).map(([sector, color]) => (
            <div key={sector} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: color.fill, border: `1.5px solid ${color.stroke}` }}
              />
              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Sector {sector}</span>
            </div>
          ))}
        </div>

        {(markers.length > 0 || fraccionesGeo.length > 0) && (
          <div className="flex flex-wrap gap-3 ml-auto items-center">
            {fraccionesGeo.length > 0 && (() => {
              const conUbicacion = fraccionesGeo.filter(f => {
                const lat = Number(f.sm?.latitud); const lng = Number(f.sm?.longitud);
                return f.sm && f.sm.latitud && !isNaN(lat) && lat !== 0;
              }).length;
              const sinUbicacion = fraccionesGeo.filter(f => f.sm && !(() => {
                const lat = Number(f.sm?.latitud);
                return f.sm.latitud && !isNaN(lat) && lat !== 0;
              })()).length;
              const sinSM = fraccionesGeo.filter(f => !f.sm).length;
              return (
                <>
                  {conUbicacion > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 rounded-sm border-2 border-emerald-500 bg-emerald-200" />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{conUbicacion} SM ubicada</span>
                    </div>
                  )}
                  {sinUbicacion > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 rounded-sm border-2 border-blue-500 bg-blue-200" />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{sinUbicacion} SM sin ubicación</span>
                    </div>
                  )}
                  {sinSM > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 rounded-sm border-2 border-amber-400 bg-amber-100" />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{sinSM} sin SM</span>
                    </div>
                  )}
                </>
              );
            })()}
            {markers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {markers.length} ubicaciones
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      <PrintFooter ctx={printContext} />
    </div>
  );
};

export default MapTerritorial;
