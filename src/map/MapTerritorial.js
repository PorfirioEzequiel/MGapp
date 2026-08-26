import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow, OverlayView, Autocomplete } from '@react-google-maps/api';

import { GOOGLE_MAPS_API_KEY as GOOGLE_API_KEY, GOOGLE_MAPS_LIBRARIES as GOOGLE_LIBRARIES } from '../utils/googleMapsConfig';
const DEFAULT_CENTER = { lat: 19.66, lng: -98.99 };

// ── Punto dentro de polígono (ray casting) ───────────────────────────────────
const pointInPolygon = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng, yi = ring[i].lat;
    const xj = ring[j].lng, yj = ring[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// ── Paleta de sectores ───────────────────────────────────────────────────────
const SECTOR_COLORS = [
  { fill: '#2563EB', stroke: '#1E40AF' },  // azul
  { fill: '#059669', stroke: '#065F46' },  // esmeralda
  { fill: '#D97706', stroke: '#92400E' },  // ámbar
  { fill: '#DC2626', stroke: '#991B1B' },  // rojo
  { fill: '#7C3AED', stroke: '#4C1D95' },  // violeta
  { fill: '#84CC16', stroke: '#3F6212' },  // lima
  { fill: '#0891B2', stroke: '#0E4F63' },  // cian
  { fill: '#EA580C', stroke: '#7C2D12' },  // naranja
  { fill: '#4F46E5', stroke: '#312E81' },  // índigo
  { fill: '#65A30D', stroke: '#365314' },  // lima
];

// ── Colores de partidos políticos ───────────────────────────────────────────
// Paleta diseñada para máxima legibilidad en mapa político.
// MORENA: vino oscuro casi-negro (peso visual pesado, sombrío)
// PRI:    rojo-coral brillante (contraste de valor claro vs oscuro de MORENA)
// PT:     naranja-bermellón (familia cálida pero distinta del rojo)
// PRD:    ámbar dorado (evita el amarillo puro que no contrasta en fondo blanco)
const PARTY_COLORS = {
  MORENA: { fill: '#6B0B20', stroke: '#360008', label: 'MORENA' },
  PRI:    { fill: '#F04E5A', stroke: '#B82030', label: 'PRI' },
  PAN:    { fill: '#1460A8', stroke: '#093E78', label: 'PAN' },
  PRD:    { fill: '#E8B200', stroke: '#9C7400', label: 'PRD' },
  PT:     { fill: '#F07030', stroke: '#B84810', label: 'PT' },
  PVEM:   { fill: '#22C55E', stroke: '#15803D', label: 'PVEM' },
  MC:     { fill: '#F59E0B', stroke: '#B45309', label: 'MC' },
};

// Colores para Ayuntamiento 2024 (candidatos como llaves)
const PARTY_COLORS_2024 = {
  ROSI:  { fill: '#6B0B20', stroke: '#360008', label: 'Rosa Yolanda Wong' },
  AARON: { fill: '#1460A8', stroke: '#093E78', label: 'Aaron Urbina' },
  MC:    { fill: '#F59E0B', stroke: '#B45309', label: 'MC' },
  PT:    { fill: '#F07030', stroke: '#B84810', label: 'PT' },
  PVEM:  { fill: '#22C55E', stroke: '#15803D', label: 'PVEM' },
};

// Colores para Senaduría 2024
const PARTY_COLORS_SENADO = {
  MARIELA: { fill: '#6B0B20', stroke: '#360008', label: 'Mariela Gutiérrez' },
  FUERZA:  { fill: '#1460A8', stroke: '#093E78', label: 'Fuerza x México' },
  MC:      { fill: '#F59E0B', stroke: '#B45309', label: 'MC' },
};

// Colores para Diputación Local 2024 (Lilia/Fuerza=azul, Samuel/Ángel=guinda, MC=ámbar)
const PARTY_COLORS_DIP = {
  MORENA: { fill: '#6B0B20', stroke: '#360008', label: 'Samuel Hernández Cruz' },
  PRI:    { fill: '#1460A8', stroke: '#093E78', label: 'PRI · Fuerza y Corazón' },
  MC:     { fill: '#F59E0B', stroke: '#B45309', label: 'MC' },
};

// ── Alias de secciones históricas (fallback) ──────────────────────────────────
// Solo activa si la sección no tiene datos propios en el dataset.
// 7011-7017 siempre caen a 4213; 6857-6867 caen a 4251.
const SECTION_ALIASES = {
  7011: 4213, 7012: 4213, 7013: 4213,
  7014: 4213, 7015: 4213, 7016: 4213, 7017: 4213,
  7018: 4228, 7019: 4228, 7020: 4228,
  7021: 4228, 7022: 4228, 7023: 4228, 7024: 4228,
  6857: 4251, 6858: 4251, 6859: 4251, 6860: 4251, 6861: 4251,
  6862: 4251, 6863: 4251, 6864: 4251, 6865: 4251, 6866: 4251, 6867: 4251,
};

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

// [W, H] per zoom tier (tier 0 = very far out, tier 3 = very close in)
const CASILLA_SIZES = [[20, 26], [27, 35], [34, 44], [44, 57]];

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
      // Labels with high contrast + thick white halo so they read over colored polygons
      { elementType: 'labels.text.fill', stylers: [{ color: '#1a1a2e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff', weight: 4 }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#1a1a2e' }] },
      { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#1a1a2e' }] },
      { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#1a1a2e' }] },
      { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#374151', visibility: 'on' }] },
      { featureType: 'administrative.neighborhood', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff', weight: 4 }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a5f' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff', weight: 4 }] },
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

const HoverTooltip = ({ data, pos, containerRef, isDark, tipo = 'seccion', seccional, sp, sms = [], afil = null, electoral = null }) => {
  if (!data || !containerRef.current) return null;

  const containerW = containerRef.current.offsetWidth;
  const containerH = containerRef.current.offsetHeight;
  const tooltipW   = 300;
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
          <div className="space-y-1 max-h-[96px] overflow-y-auto">
            {sms.map((c, i) => {
              const hasPhoto = Boolean(c.url_foto_perfil);
              const name = [c.nombre, c.a_paterno].filter(Boolean).join(' ');
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center border ${
                    isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-100'
                  }`}>
                    {hasPhoto ? (
                      <img src={c.url_foto_perfil} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" fill={isDark ? '#475569' : '#94a3b8'}/>
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" fill="none"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs truncate ${val}`}>{name || '—'}</span>
                </div>
              );
            })}
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

      {/* Datos electorales */}
      {electoral && (
        <div className={`mt-2 pt-2 border-t ${divider}`}>
          <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 mb-1.5">
            <span className={`text-xs font-semibold ${sub}`}>
              {electoral.isDip2024  ? 'Diputación Local 2024 - Interno'
               : electoral.isSenado  ? 'Senaduría 2024'
               : electoral.is2024    ? 'Electoral 2024'
               : electoral.isIEEM    ? 'Electoral 2021 — IEEM'
               : 'Electoral 2021'}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white max-w-full truncate"
              title={(electoral.isSenado ? PARTY_COLORS_SENADO : electoral.isDip2024 ? PARTY_COLORS_DIP : electoral.is2024 ? PARTY_COLORS_2024 : PARTY_COLORS)[electoral.winner]?.label || electoral.winner}
              style={{ backgroundColor: (electoral.isSenado ? PARTY_COLORS_SENADO : electoral.isDip2024 ? PARTY_COLORS_DIP : electoral.is2024 ? PARTY_COLORS_2024 : PARTY_COLORS)[electoral.winner]?.fill || '#6B7280' }}
            >
              {(electoral.isSenado ? PARTY_COLORS_SENADO : electoral.isDip2024 ? PARTY_COLORS_DIP : electoral.is2024 ? PARTY_COLORS_2024 : PARTY_COLORS)[electoral.winner]?.label || electoral.winner}
            </span>
          </div>

          {/* Comparativa MG vs Fuerza (solo senado) */}
          {electoral.isSenado && electoral.mg_vs_fuerza != null && (
            <div className={`mb-1.5 pb-1.5 border-b ${divider}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${sub}`}>MG vs Fuerza</span>
                <span className={`text-[11px] font-bold tabular-nums ${
                  electoral.mg_vs_fuerza >= 0
                    ? (isDark ? 'text-red-400' : 'text-red-800')
                    : (isDark ? 'text-blue-400' : 'text-blue-700')
                }`}>
                  {electoral.mg_vs_fuerza >= 0 ? '+' : ''}{Number(electoral.mg_vs_fuerza).toLocaleString()}
                </span>
              </div>
              {electoral.total > 0 && (
                <div className={`h-1.5 mt-1 rounded-full overflow-hidden flex ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="h-full rounded-l-full" style={{ width: `${(electoral.votes.MARIELA / electoral.total) * 100}%`, backgroundColor: PARTY_COLORS_SENADO.MARIELA.fill }} />
                  <div className="h-full rounded-r-full" style={{ width: `${(electoral.votes.FUERZA  / electoral.total) * 100}%`, backgroundColor: PARTY_COLORS_SENADO.FUERZA.fill }} />
                </div>
              )}
              {electoral.casillas != null && (
                <p className={`text-[10px] mt-0.5 ${sub}`}>Casillas: {electoral.casillas}</p>
              )}
            </div>
          )}

          {/* Comparativa Rosi vs Aaron (solo 2024) */}
          {electoral.is2024 && electoral.rosi_vs_aaron != null && (
            <div className={`mb-1.5 pb-1.5 border-b ${divider}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${sub}`}>Rosa vs Aaron</span>
                <span className={`text-[11px] font-bold tabular-nums ${
                  electoral.rosi_vs_aaron >= 0
                    ? (isDark ? 'text-blue-400' : 'text-blue-700')
                    : (isDark ? 'text-red-400' : 'text-red-700')
                }`}>
                  {electoral.rosi_vs_aaron >= 0 ? '+' : ''}{Number(electoral.rosi_vs_aaron).toLocaleString()}
                </span>
              </div>
              {electoral.total > 0 && (
                <div className={`h-1.5 mt-1 rounded-full overflow-hidden flex ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="h-full bg-blue-600 rounded-l-full" style={{ width: `${(electoral.votes.ROSI / electoral.total) * 100}%` }} />
                  <div className="h-full bg-red-700 rounded-r-full" style={{ width: `${(electoral.votes.AARON / electoral.total) * 100}%` }} />
                </div>
              )}
              {electoral.casillas != null && (
                <p className={`text-[10px] mt-0.5 ${sub}`}>Casillas: {electoral.casillas}</p>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            {Object.entries(electoral.votes)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([party, votes]) => {
                const palette = electoral.isSenado ? PARTY_COLORS_SENADO : electoral.isDip2024 ? PARTY_COLORS_DIP : electoral.is2024 ? PARTY_COLORS_2024 : PARTY_COLORS;
                const fillColor = palette[party]?.fill || '#6B7280';
                const label = palette[party]?.label || party;
                return (
                  <div key={party} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: fillColor }} />
                    <span className={`text-xs ${sub} w-24 truncate`} title={label}>{label}</span>
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full" style={{ width: `${(votes / electoral.total) * 100}%`, backgroundColor: fillColor }} />
                    </div>
                    <span className={`text-xs tabular-nums ${isDark ? 'text-gray-300' : 'text-gray-600'} w-10 text-right`}>
                      {Number(votes).toLocaleString()}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Desglose de coalición MORENA (solo IEEM) */}
          {electoral.isIEEM && (electoral.morena_solo > 0 || electoral.pt_solo > 0 || electoral.naem_solo > 0) && (
            <div className={`mt-1.5 pt-1.5 border-t ${divider}`}>
              <p className={`text-[10px] font-semibold ${sub} mb-0.5`}>Coalición MORENA+PT+NAEM</p>
              <div className="flex gap-2 text-[10px] tabular-nums">
                {electoral.morena_solo > 0 && (
                  <span className={isDark ? 'text-red-400' : 'text-red-700'}>M: {Number(electoral.morena_solo).toLocaleString()}</span>
                )}
                {electoral.pt_solo > 0 && (
                  <span className={isDark ? 'text-red-300' : 'text-red-600'}>PT: {Number(electoral.pt_solo).toLocaleString()}</span>
                )}
                {electoral.naem_solo > 0 && (
                  <span className={isDark ? 'text-orange-300' : 'text-orange-600'}>NAEM: {Number(electoral.naem_solo).toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          <div className={`mt-1 text-xs tabular-nums ${sub} flex justify-between`}>
            <span>
              {electoral.isSenado && electoral.votos_nulos > 0 && (
                <span>Nulos: {Number(electoral.votos_nulos).toLocaleString()}</span>
              )}
            </span>
            <span>
              Total: {Number(electoral.total).toLocaleString()}
              {electoral.diferencia_pct != null && (
                <span className="ml-2 opacity-70">Dif: {electoral.diferencia_pct}%</span>
              )}
            </span>
          </div>
        </div>
      )}

      <p className={`text-xs mt-2 pt-1.5 border-t ${divider} ${sub}`}>
        Clic para seleccionar sección
      </p>
    </div>
  );
};

// ── Parser de dirección de casilla ───────────────────────────────────────────
const parseCasillaUbicacion = (texto) => {
  if (!texto) return { nombre: '', calle: '', colonia: '', cp: '', referencia: '' };
  const parts = texto.split(', ');
  const toTitle = (s) => s ? s.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()) : '';

  const nombre = parts[0] || '';

  const cpIdx = parts.findIndex(p => /^C[OÓ]DIGO POSTAL\s+\d{5}/i.test(p));
  const cp = cpIdx >= 0 ? parts[cpIdx].replace(/C[OÓ]DIGO POSTAL\s+/i, '').trim() : '';

  const refIdx = parts.findIndex(p => /^(ENTRE|A UN |FRENTE|JUNTO|DIAGONAL|CONTIGUO)/i.test(p));
  const referencia = refIdx >= 0 ? parts.slice(refIdx).join(', ') : '';

  const calleRaw = parts[1] || '';
  const isStreet = /^(CALLE|AVENIDA|AV\b|BOULEVARD|BLVD|CARRETERA|PRIVADA|CERRADA|CALZADA|CAMINO|CIRCUITO|PASEO|PROLONGACI[OÓ]N|ACCESO|RETORNO)/i.test(calleRaw);

  let calle = '';
  let coloniaStart = 1;

  if (isStreet) {
    const numRaw = (parts[2] || '').trim();
    if (/^SIN N[UÚ]MERO$/i.test(numRaw)) {
      calle = `${calleRaw} S/N`;
      coloniaStart = 3;
    } else if (/^N[UÚ]MERO\s+\S+/i.test(numRaw)) {
      calle = `${calleRaw} #${numRaw.replace(/^N[UÚ]MERO\s+/i, '')}`;
      coloniaStart = 3;
    } else {
      calle = calleRaw;
      coloniaStart = 2;
    }
  }

  const coloniaEnd = cpIdx >= 0 ? cpIdx : (refIdx >= 0 ? refIdx : parts.length);
  const colonia = parts
    .slice(coloniaStart, coloniaEnd)
    .filter(p => !/^(TEC[AÁ]MAC|M[EÉ]XICO|ESTADO DE M[EÉ]XICO)$/i.test(p))
    .join(', ');

  return {
    nombre: toTitle(nombre),
    calle:  toTitle(calle),
    colonia: toTitle(colonia),
    cp,
    referencia: referencia ? toTitle(referencia) : '',
  };
};

// ── Ícono de casilla (reutilizable en botones, leyenda e InfoWindow) ──────────
const BallotSvg = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <rect x="1.5" y="6" width="11" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="3" y="2" width="8" height="4.5" rx="0.9" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="4.5" y1="4" x2="9.5" y2="4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

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
  editableLocation = null,
  onEditableLocationChange = null,
  electoralModeExternal = null,
  onElectoralModeChange = null,
  readOnly = false,
}) => {
  const mapRef        = useRef(null);
  const containerRef  = useRef(null);

  const [activeMarker,    setActiveMarker]    = useState(null);
  const [sectorColorMap,  setSectorColorMap]  = useState({});
  const [currentStyle,    setCurrentStyle]    = useState('claro');
  const [hovered,         setHovered]         = useState(null);  // { data, tipo }
  const [tooltipPos,      setTooltipPos]      = useState({ x: 0, y: 0 });
  const [generating,      setGenerating]      = useState(false);
  const [currentZoom,     setCurrentZoom]     = useState(11);
  const [localElectoralMode, setLocalElectoralMode] = useState(null);
  const [electoralData,          setElectoralData]          = useState({});
  const [electoralDataIEEM,      setElectoralDataIEEM]      = useState({});
  const [electoralData2024,      setElectoralData2024]      = useState({});
  const [electoralData2024IEEM,  setElectoralData2024IEEM]  = useState({});
  const [electoralDataSenado,    setElectoralDataSenado]    = useState({});
  const [electoralDataDip2024,   setElectoralDataDip2024]   = useState({});
  // Controlled from parent if onElectoralModeChange is provided, uncontrolled otherwise
  const electoralMode = onElectoralModeChange ? electoralModeExternal : localElectoralMode;
  const handleSetElectoralMode = (mode) => {
    if (onElectoralModeChange) onElectoralModeChange(mode);
    else setLocalElectoralMode(mode);
  };

  const isDark     = currentStyle === 'oscuro';
  const styleDef   = MAP_STYLE_DEFS[currentStyle];

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_API_KEY, libraries: GOOGLE_LIBRARIES });

  // Anillos de las fracciones ya parseados, para detectar en cuál cae un punto
  const fraccionRings = useMemo(
    () => fraccionesGeo
      .map(f => ({ fraccion: f.fraccion, rings: parseWKT(f.geometry) }))
      .filter(f => f.rings.length),
    [fraccionesGeo]
  );

  const findFraccionAt = useCallback((lat, lng) => {
    const point = { lat, lng };
    const hit = fraccionRings.find(f => f.rings.some(ring => pointInPolygon(point, ring)));
    return hit ? hit.fraccion : null;
  }, [fraccionRings]);

  // Fracción que contiene actualmente al marcador editable (para resaltarla)
  const assignedFraccion = editableLocation
    ? findFraccionAt(editableLocation.lat, editableLocation.lng)
    : null;

  // Casillas PJEM (Poder Judicial del Estado de México) — ubicaciones físicas
  // de casillas, una por sección, geolocalizadas a partir de las ligas cortas
  // de Google Maps del archivo fuente "TECAMAC CASILLAS PJEM".
  const [casillasPjem, setCasillasPjem] = useState([]);
  const [showCasillasPjem, setShowCasillasPjem] = useState(false);
  const [activeCasilla, setActiveCasilla] = useState(null);
  useEffect(() => {
    fetch('/tecamac_casillas_pjem.json')
      .then(r => r.json())
      .then(setCasillasPjem)
      .catch(() => {});
  }, []);

  // Sólo se pintan las casillas de las secciones que el mapa ya trae cargadas
  // (mismo universo que los polígonos visibles), no las 209 completas siempre.
  const casillasVisibles = useMemo(() => {
    if (!showCasillasPjem || !casillasPjem.length || !secciones.length) return [];
    const seccionesCargadas = new Set(secciones.map(s => Number(s.seccion)));
    return casillasPjem.filter(c => seccionesCargadas.has(Number(c.seccion)) && c.lat && c.lng);
  }, [showCasillasPjem, casillasPjem, secciones]);

  const casillaTier = currentZoom >= 16 ? 3 : currentZoom >= 14 ? 2 : currentZoom >= 12 ? 1 : 0;
  const urnaIcon = useMemo(() => {
    if (!window.google || !isLoaded) return undefined;
    const [W, H] = CASILLA_SIZES[casillaTier];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 34 44"><ellipse cx="17" cy="41.5" rx="5.5" ry="1.8" fill="rgba(0,0,0,0.20)"/><path d="M17 2C9.8 2 4 7.8 4 15c0 10 13 26.5 13 26.5S30 25 30 15C30 7.8 24.2 2 17 2z" fill="#F59E0B" stroke="#D97706" stroke-width="1.2"/><circle cx="17" cy="14.5" r="10" fill="rgba(255,255,255,0.12)"/><rect x="10" y="10" width="14" height="3.5" rx="1.2" fill="rgba(255,255,255,0.97)"/><rect x="13" y="10.8" width="8" height="1.6" rx="0.7" fill="#92400E"/><polygon points="11,13.5 23,13.5 22,22 12,22" fill="rgba(255,255,255,0.93)"/><line x1="13" y1="17.5" x2="21" y2="17.5" stroke="rgba(146,64,14,0.20)" stroke-width="0.8"/><rect x="12.5" y="22" width="2.5" height="1.5" rx="0.4" fill="rgba(255,255,255,0.85)"/><rect x="19" y="22" width="2.5" height="1.5" rx="0.4" fill="rgba(255,255,255,0.85)"/></svg>`;
    return {
      url: 'data:image/svg+xml;base64,' + btoa(svg),
      scaledSize: new window.google.maps.Size(W, H),
      anchor: new window.google.maps.Point(Math.round(W / 2), H - 1),
    };
  }, [isLoaded, casillaTier]);

  // Dataset electoral interno (Ayuntamiento 2021)
  useEffect(() => {
    fetch('/electoral_2021.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData(m);
      })
      .catch(err => console.error('Error cargando electoral_2021.json', err));
  }, []);

  // Dataset electoral oficial IEEM (Ayuntamiento 2021)
  useEffect(() => {
    fetch('/electoral_2021_ieem.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataIEEM(m);
      })
      .catch(err => console.error('Error cargando electoral_2021_ieem.json', err));
  }, []);

  // Dataset electoral Ayuntamiento 2024
  useEffect(() => {
    fetch('/electoral_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData2024(m);
      })
      .catch(err => console.error('Error cargando electoral_2024.json', err));
  }, []);

  // Dataset electoral Ayuntamiento 2024 — cómputo oficial IEEM
  useEffect(() => {
    fetch('/electoral_2024_ieem.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData2024IEEM(m);
      })
      .catch(err => console.error('Error cargando electoral_2024_ieem.json', err));
  }, []);

  // Dataset electoral Senaduría 2024
  useEffect(() => {
    fetch('/electoral_senado_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataSenado(m);
      })
      .catch(err => console.error('Error cargando electoral_senado_2024.json', err));
  }, []);

  // Dataset Diputación Local 2024
  useEffect(() => {
    fetch('/dip_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataDip2024(m);
      })
      .catch(err => console.error('Error cargando dip_2024.json', err));
  }, []);

  const getElectoralResult = useCallback((seccion) => {
    const d = electoralData[seccion] ?? electoralData[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador_partido, morena = 0, pri = 0, pan = 0, pvem = 0, mc = 0, prd = 0, pt = 0, total = 0, diferencia_pct } = d;
    const votes = { MORENA: morena, PRI: pri };
    if (pt   > 0) votes.PT   = pt;
    if (pan  > 0) votes.PAN  = pan;
    if (pvem > 0) votes.PVEM = pvem;
    if (mc   > 0) votes.MC   = mc;
    if (prd  > 0) votes.PRD  = prd;
    return { winner: ganador_partido, votes, total, diferencia_pct };
  }, [electoralData]);

  const getElectoralResultSenado = useCallback((seccion) => {
    const d = electoralDataSenado[seccion] ?? electoralDataSenado[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador, morena_coalicion = 0, fuerza_x_mexico = 0, senado_mc = 0,
            mg_vs_fuerza = 0, votos_nulos = 0, total_votos = 0, lista_nominal = 0,
            diferencia_pct, casillas } = d;
    const votes = {};
    if (morena_coalicion > 0) votes.MARIELA = morena_coalicion;
    if (fuerza_x_mexico  > 0) votes.FUERZA  = fuerza_x_mexico;
    if (senado_mc        > 0) votes.MC       = senado_mc;
    return { winner: ganador, votes, total: total_votos, diferencia_pct,
             mg_vs_fuerza, votos_nulos, lista_nominal, casillas, isSenado: true };
  }, [electoralDataSenado]);

  const getElectoralResult2024 = useCallback((seccion) => {
    // 2024: 6546 y 6857-6867 tienen datos propios. 7011-7024 usan alias.
    const d = electoralData2024[seccion] ?? electoralData2024[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador, rosi = 0, aaron = 0, mc = 0, pt = 0, pvem = 0, total = 0, diferencia_pct, casillas, rosi_vs_aaron } = d;
    const votes = {};
    if (rosi  > 0) votes.ROSI  = rosi;
    if (aaron > 0) votes.AARON = aaron;
    if (mc    > 0) votes.MC    = mc;
    if (pt    > 0) votes.PT    = pt;
    if (pvem  > 0) votes.PVEM  = pvem;
    return { winner: ganador, votes, total, diferencia_pct, casillas, rosi_vs_aaron, is2024: true };
  }, [electoralData2024]);

  const getElectoralResult2024IEEM = useCallback((seccion) => {
    const d = electoralData2024IEEM[seccion] ?? electoralData2024IEEM[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador, rosi = 0, aaron = 0, mc = 0, pt = 0, pvem = 0,
            total_validos = 0, votos_nulos = 0, total = 0, diferencia_pct, casillas, rosi_vs_aaron } = d;
    const votes = {};
    if (rosi  > 0) votes.ROSI  = rosi;
    if (aaron > 0) votes.AARON = aaron;
    if (mc    > 0) votes.MC    = mc;
    if (pt    > 0) votes.PT    = pt;
    if (pvem  > 0) votes.PVEM  = pvem;
    return { winner: ganador, votes, total: total_validos || total, diferencia_pct,
             casillas, rosi_vs_aaron, votos_nulos, is2024: true, is2024IEEM: true };
  }, [electoralData2024IEEM]);

  const getElectoralResultIEEM = useCallback((seccion) => {
    // IEEM: 6546 tiene datos propios; 7011-7024 y 6857-6867 usan alias histórico
    const d = electoralDataIEEM[seccion] ?? electoralDataIEEM[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador_partido, morena_coalicion = 0, morena = 0, pt = 0, naem = 0, pri = 0, pan = 0, pvem = 0, mc = 0, prd = 0, total = 0, diferencia_pct } = d;
    // MORENA = total coalición candidatura común (MORENA+PT+NAEM)
    const votes = { MORENA: morena_coalicion, PRI: pri };
    if (pan  > 0) votes.PAN  = pan;
    if (pvem > 0) votes.PVEM = pvem;
    if (mc   > 0) votes.MC   = mc;
    if (prd  > 0) votes.PRD  = prd;
    return { winner: ganador_partido, votes, total, diferencia_pct, morena_solo: morena, pt_solo: pt, naem_solo: naem, isIEEM: true };
  }, [electoralDataIEEM]);

  const getElectoralResultDip2024 = useCallback((seccion) => {
    const d = electoralDataDip2024[seccion] ?? electoralDataDip2024[SECTION_ALIASES[seccion]];
    if (!d) return null;
    const { ganador, morena = 0, pri = 0, mc = 0, total = 0 } = d;
    const votes = {};
    if (morena > 0) votes.MORENA = morena;
    if (pri    > 0) votes.PRI    = pri;
    if (mc     > 0) votes.MC     = mc;
    return { winner: ganador, votes, total, isDip: true, isDip2024: true };
  }, [electoralDataDip2024]);

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

  // Pan al marcador editable cuando se coloca o se actualiza (p.ej. escribiendo lat/lng a mano)
  useEffect(() => {
    if (!editableLocation || !mapRef.current || !window.google) return;
    mapRef.current.panTo(editableLocation);
  }, [editableLocation]);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setCurrentZoom(map.getZoom());
  }, []);

  const onZoomChanged = useCallback(() => {
    if (mapRef.current) setCurrentZoom(mapRef.current.getZoom());
  }, []);

  // ── Generar PDF con formato ───────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    if (!mapRef.current || !window.google) return;
    setGenerating(true);
    try {
      // 1. Fit bounds al contenido actual
      const bounds = new window.google.maps.LatLngBounds();
      let hasBounds = false;
      const hasFracGeo = fraccionesGeo.some(f => f.geometry && parseWKT(f.geometry).length > 0);
      const geoSource  = hasFracGeo ? fraccionesGeo : secciones;
      geoSource.forEach(item => {
        parseWKT(item.geometry ?? '').flat().forEach(p => { bounds.extend(p); hasBounds = true; });
      });
      if (hasBounds) mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });

      // 2. Esperar que el mapa termine de mover
      await new Promise(resolve => {
        const listener = window.google.maps.event.addListenerOnce(mapRef.current, 'idle', resolve);
        setTimeout(() => { window.google.maps.event.removeListener(listener); resolve(); }, 3000);
      });
      await new Promise(r => setTimeout(r, 200));

      // 3. Obtener centro y zoom para Google Static Maps API
      const center = mapRef.current.getCenter();
      const zoom   = Math.min(mapRef.current.getZoom(), 15);
      const clat   = center.lat().toFixed(6);
      const clng   = center.lng().toFixed(6);

      const simplify = (pts, maxPts = 16) => {
        if (pts.length <= maxPts) return pts;
        const step = Math.ceil(pts.length / maxPts);
        const out = [];
        for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
        return out;
      };
      const toHex6 = (hex) => hex.replace('#', '').substring(0, 6).padStart(6, '0');

      let pathParams = '';
      let urlLen = 0;
      const URL_LIMIT = 7800;

      if (hasFracGeo) {
        fraccionesGeo.forEach(f => {
          const lat = Number(f.sm?.latitud);
          const located = f.sm && lat && !isNaN(lat) && lat !== 0;
          const fill   = located ? '10B98160' : '94A3B860';
          const stroke = located ? '047857ff' : '64748Bff';
          parseWKT(f.geometry ?? '').forEach(ring => {
            const pts = simplify(ring, 16);
            const ptsStr = pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
            const param = `&path=color:0x${stroke}|fillcolor:0x${fill}|weight:2|${ptsStr}`;
            if (urlLen + param.length <= URL_LIMIT) { pathParams += param; urlLen += param.length; }
          });
        });
      } else {
        secciones.forEach(sec => {
          const colors = sectorColorMap[sec.pologono] ?? SECTOR_COLORS[0];
          const fill   = `${toHex6(colors.fill)}60`;
          const stroke = `${toHex6(colors.stroke)}ff`;
          parseWKT(sec.geometry ?? '').forEach(ring => {
            const pts = simplify(ring, 16);
            const ptsStr = pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
            const param = `&path=color:0x${stroke}|fillcolor:0x${fill}|weight:2|${ptsStr}`;
            if (urlLen + param.length <= URL_LIMIT) { pathParams += param; urlLen += param.length; }
          });
        });
      }

      // Área del mapa en A4 landscape ≈ 277×132 mm → solicitar 640×305 @scale=2 (=1280×610 px efectivos)
      const staticUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${clat},${clng}&zoom=${zoom}&size=640x305&scale=2` +
        `&maptype=roadmap&key=${GOOGLE_API_KEY}${pathParams}`;

      // Descargar imagen como blob (sin restricciones CORS del canvas)
      const resp = await fetch(staticUrl);
      if (!resp.ok) throw new Error(`Static Maps HTTP ${resp.status}`);
      const blob = await resp.blob();
      const mapImgUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });

      // 4. Construir PDF con jsPDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297, M = 10, CW = W - M * 2;

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(15, 42, 74);
      doc.rect(0, 0, W, 21, 'F');
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 21, W, 2, 'F');

      doc.setFillColor(29, 78, 216);
      doc.roundedRect(M, 5, 13, 11, 1.5, 1.5, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('MG', M + 6.5, 12, { align: 'center' });

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TABLERO TERRITORIAL', M + 17, 10.5);

      if (printContext?.breadcrumb) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 180, 230);
        doc.text(printContext.breadcrumb, M + 17, 17);
      }

      const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 180, 230);
      doc.text(fecha, W - M, 9, { align: 'right' });

      if (printContext?.levelValue) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(253, 224, 120);
        doc.text(printContext.levelValue, W - M, 18, { align: 'right' });
      }

      // ── Imagen del mapa ──────────────────────────────────────────────────
      const mapY = 25, mapH = 132;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(M, mapY, CW, mapH);
      doc.addImage(mapImgUrl, 'JPEG', M, mapY, CW, mapH);

      // ── Barra de estadísticas ────────────────────────────────────────────
      const statsY = mapY + mapH + 3;
      doc.setFillColor(248, 250, 252);
      doc.rect(0, statsY, W, 30, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(0, statsY, W, statsY);

      const afPct = printContext?.afiliados && printContext?.credenciales
        ? ` (${((printContext.credenciales / printContext.afiliados) * 100).toFixed(0)}%)`
        : '';

      const items = [
        printContext?.listaNominal && { label: 'Lista Nominal', value: Number(printContext.listaNominal).toLocaleString('es-MX'), rgb: [29, 78, 216] },
        { label: 'Secciones', value: String(printContext?.secciones ?? '—'), rgb: [30, 64, 175] },
        printContext?.ubicados    && { label: 'Ubicados', value: String(printContext.ubicados), rgb: [5, 150, 105] },
        printContext?.promotores  && { label: 'Promotores SM', value: String(printContext.promotores), rgb: [37, 99, 235] },
        printContext?.fracciones  && { label: 'Fracciones', value: String(printContext.fracciones), rgb: [79, 70, 229] },
        printContext?.afiliados   && { label: 'Afiliados', value: Number(printContext.afiliados).toLocaleString('es-MX'), rgb: [15, 118, 110] },
        printContext?.credenciales && { label: 'Credenciales', value: `${Number(printContext.credenciales).toLocaleString('es-MX')}${afPct}`, rgb: [15, 118, 110] },
      ].filter(Boolean);

      const colW = CW / items.length;
      items.forEach((item, i) => {
        const x = M + i * colW + colW / 2;
        if (i > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.25);
          doc.line(M + i * colW, statsY + 3, M + i * colW, statsY + 23);
        }
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(item.label.toUpperCase(), x, statsY + 6, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...item.rgb);
        doc.text(item.value, x, statsY + 17, { align: 'center' });
      });

      // ── Pie ──────────────────────────────────────────────────────────────
      const footY = statsY + 29;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(M, footY, W - M, footY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const respParts = [];
      if (printContext?.sp)       respParts.push(`SP: ${printContext.sp}`);
      if (printContext?.seccional) respParts.push(`RS: ${printContext.seccional}`);
      if (respParts.length) doc.text(respParts.join('   ·   '), M, footY + 5);

      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text('Documento informativo para operaciones en campo · Sistema de Gestión Electoral', W - M, footY + 5, { align: 'right' });

      // ── Guardar ───────────────────────────────────────────────────────────
      const name = (printContext?.levelValue ?? 'municipio').toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '');
      doc.save(`tablero-${name}-${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (err) {
      console.error('Error generando PDF:', err);
      alert(`Error al generar el PDF: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }, [secciones, fraccionesGeo, printContext, sectorColorMap]);

  // Inject print CSS once on mount
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'map-print-style';
    el.textContent = PRINT_STYLE;
    document.head.appendChild(el);
    return () => document.getElementById('map-print-style')?.remove();
  }, []);

  // Clic en el mapa: coloca o mueve el marcador editable y, si cae dentro de
  // una fracción, la reporta para que el formulario reasigne esa fracción.
  const handleMapClick = useCallback((e) => {
    if (!onEditableLocationChange) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    onEditableLocationChange(lat, lng, findFraccionAt(lat, lng));
  }, [onEditableLocationChange, findFraccionAt]);

  const handleEditableMarkerDragEnd = useCallback((e) => {
    if (!onEditableLocationChange) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    onEditableLocationChange(lat, lng, findFraccionAt(lat, lng));
  }, [onEditableLocationChange, findFraccionAt]);

  // ── Buscador de calle (Google Places Autocomplete) ──────────────────────
  const autocompleteRef = useRef(null);
  const onAutocompleteLoad = useCallback((ac) => { autocompleteRef.current = ac; }, []);
  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) return;
    const lat = loc.lat();
    const lng = loc.lng();
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(18);
    }
    onEditableLocationChange?.(lat, lng, findFraccionAt(lat, lng));
  }, [onEditableLocationChange, findFraccionAt]);

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
        <div className="no-print absolute top-3 left-3 z-10 flex flex-wrap gap-1 max-w-xs bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-200">
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
          {Object.keys(electoralData).length > 0 && (
            <>
              <div className="w-full h-px bg-gray-200 my-0.5" />
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'ayu_2021' ? null : 'ayu_2021')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'ayu_2021'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Datos internos — Ayuntamiento 2021"
              >
                <BallotSvg /> Ayuntamiento 2021 - interno
              </button>
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'ayu_2021_ieem' ? null : 'ayu_2021_ieem')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'ayu_2021_ieem'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Cómputo oficial IEEM — Ayuntamiento 2021"
              >
                <BallotSvg /> Ayuntamiento 2021 - IEEM
              </button>
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'ayu_2024' ? null : 'ayu_2024')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'ayu_2024'
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Ayuntamiento 2024 — Rosi Wong vs Aaron Urbina (datos internos)"
              >
                <BallotSvg /> Ayuntamiento 2024 - Rosi Wong
              </button>
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'ayu_2024_ieem' ? null : 'ayu_2024_ieem')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'ayu_2024_ieem'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Ayuntamiento 2024 — Cómputo oficial IEEM"
              >
                <BallotSvg /> Ayuntamiento 2024 - IEEM
              </button>
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'senado_2024' ? null : 'senado_2024')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'senado_2024'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Senaduría 2024 — Mariela Gutiérrez vs Fuerza x México"
              >
                <BallotSvg /> Senaduría 2024 - Mariela Gutiérrez
              </button>
              <button
                onClick={() => handleSetElectoralMode(electoralMode === 'dip_2024' ? null : 'dip_2024')}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  electoralMode === 'dip_2024'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Diputación Local 2024 — datos internos"
              >
                <BallotSvg /> Diputación Local 2024 - Interno
              </button>
            </>
          )}
          {casillasPjem.length > 0 && (
            <>
              <div className="w-full h-px bg-gray-200 my-0.5" />
              <button
                onClick={() => setShowCasillasPjem(v => !v)}
                className={`w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all text-left leading-tight ${
                  showCasillasPjem
                    ? 'bg-amber-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Ubicaciones físicas de casillas — PJEM"
              >
                <BallotSvg /> Casillas PJEM
              </button>
            </>
          )}
        </div>

        {/* Botones de exportación (solo cuando no hay modo editable y no es visor readOnly) */}
        {!onEditableLocationChange && !readOnly && (
          <div className="no-print absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
              title="Imprimir lo que se ve en pantalla"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 6V2h8v4M4 12H2a1 1 0 01-1-1V6.5a1 1 0 011-1h12a1 1 0 011 1V11a1 1 0 01-1 1h-2M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Imprimir
            </button>
            <button
              onClick={generatePDF}
              disabled={generating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md border text-xs font-semibold transition-all ${
                generating
                  ? 'bg-blue-50 border-blue-200 text-blue-400 cursor-wait'
                  : 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700 shadow-blue-200'
              }`}
              title="Generar PDF centrado en el área seleccionada"
            >
              {generating ? (
                <>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                  </svg>
                  Generando…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 12l5-5 5 5M8 7V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 14h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Generar PDF
                </>
              )}
            </button>
          </div>
        )}

        {onEditableLocationChange && (
          <div className={`absolute top-3 right-3 z-10 rounded-lg shadow-md px-3 py-1.5 text-xs font-medium border ${
            isDark ? 'bg-gray-900/90 text-gray-200 border-gray-700' : 'bg-white/90 text-gray-700 border-gray-200'
          }`}>
            {editableLocation ? '✥ Arrastra el marcador para ajustar la ubicación' : '📍 Haz clic en el mapa para marcar la ubicación'}
          </div>
        )}

        {onEditableLocationChange && isLoaded && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 w-[85%] max-w-xs">
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={onPlaceChanged}
              options={{ componentRestrictions: { country: 'mx' } }}
            >
              <input
                type="text"
                placeholder="🔎 Buscar calle o dirección..."
                className={`w-full px-3 py-1.5 rounded-lg shadow-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark ? 'bg-gray-900/90 text-gray-100 border-gray-700 placeholder-gray-500' : 'bg-white/95 text-gray-700 border-gray-200'
                }`}
              />
            </Autocomplete>
          </div>
        )}

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={DEFAULT_CENTER}
          zoom={11}
          onLoad={onLoad}
          onZoomChanged={onZoomChanged}
          onClick={handleMapClick}
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
              const elResult   = electoralMode === 'ayu_2021'
                ? getElectoralResult(sec.seccion)
                : electoralMode === 'ayu_2021_ieem'
                  ? getElectoralResultIEEM(sec.seccion)
                  : electoralMode === 'ayu_2024'
                    ? getElectoralResult2024(sec.seccion)
                    : electoralMode === 'ayu_2024_ieem'
                      ? getElectoralResult2024IEEM(sec.seccion)
                      : electoralMode === 'senado_2024'
                        ? getElectoralResultSenado(sec.seccion)
                        : electoralMode === 'dip_2024'
                          ? getElectoralResultDip2024(sec.seccion)
                          : null;
              const colorPalette = (electoralMode === 'ayu_2024' || electoralMode === 'ayu_2024_ieem') ? PARTY_COLORS_2024
                                 : electoralMode === 'senado_2024' ? PARTY_COLORS_SENADO
                                 : electoralMode === 'dip_2024' ? PARTY_COLORS_DIP
                                 : PARTY_COLORS;
              const color      = elResult
                ? (colorPalette[elResult.winner] || { fill: '#6B7280', stroke: '#374151' })
                : (sectorColorMap[sec.pologono] || SECTOR_COLORS[0]);
              const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;
              const isBg       = isSelected && hasFracGeom;
              const isHovered  = hovered?.tipo === 'seccion' && hovered?.data?.seccion === sec.seccion;
              const _aliasTarget = SECTION_ALIASES[sec.seccion];
              const isAliased  = electoralMode === 'ayu_2021'
                ? (electoralData[sec.seccion] === undefined && _aliasTarget !== undefined)
                : electoralMode === 'ayu_2021_ieem'
                  ? (electoralDataIEEM[sec.seccion] === undefined && _aliasTarget !== undefined)
                  : electoralMode === 'ayu_2024'
                    ? (electoralData2024[sec.seccion] === undefined && _aliasTarget !== undefined
                       && electoralData2024[_aliasTarget] !== undefined)
                    : electoralMode === 'ayu_2024_ieem'
                      ? (electoralData2024IEEM[sec.seccion] === undefined && _aliasTarget !== undefined
                         && electoralData2024IEEM[_aliasTarget] !== undefined)
                      : electoralMode === 'senado_2024'
                        ? (electoralDataSenado[sec.seccion] === undefined && _aliasTarget !== undefined
                           && electoralDataSenado[_aliasTarget] !== undefined)
                        : electoralMode === 'dip_2024'
                          ? (electoralDataDip2024[sec.seccion] === undefined && _aliasTarget !== undefined
                             && electoralDataDip2024[_aliasTarget] !== undefined)
                          : false;

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
                        fillColor:    isSelected && !electoralMode ? '#FBBF24' : color.fill,
                        strokeColor:  isSelected && !electoralMode ? '#B45309' : isHovered ? '#1e1e1e' : isAliased ? color.fill : color.stroke,
                        fillOpacity:  isBg ? 0.05 : isSelected ? 0.75 : isHovered ? 0.65 : electoralMode ? 0.60 : isDark ? 0.50 : 0.38,
                        strokeWeight: isBg ? 3 : isSelected ? 3 : isHovered ? 2.5 : isAliased ? 1 : 1.5,
                        strokeOpacity: isAliased ? 0.15 : 0.85,
                        zIndex:       isBg ? 1 : isSelected ? 20 : isHovered ? 10 : isAliased ? 5 : 2,
                        clickable:    !isBg,
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            });
          })()}

          {/* ── Etiquetas de sección (zoom-aware) ──────────────────── */}
          {currentZoom >= 12 && secciones.map((sec, idx) => {
            const paths = parseWKT(sec.geometry);
            if (!paths.length) return null;
            const center = getCenter(paths);
            const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;
            const _at = SECTION_ALIASES[sec.seccion];
            const isAliased  = electoralMode === 'ayu_2021'
              ? (electoralData[sec.seccion] === undefined && _at !== undefined)
              : electoralMode === 'ayu_2021_ieem'
                ? (electoralDataIEEM[sec.seccion] === undefined && _at !== undefined)
                : electoralMode === 'ayu_2024'
                  ? (electoralData2024[sec.seccion] === undefined && _at !== undefined && electoralData2024[_at] !== undefined)
                  : electoralMode === 'ayu_2024_ieem'
                    ? (electoralData2024IEEM[sec.seccion] === undefined && _at !== undefined && electoralData2024IEEM[_at] !== undefined)
                    : electoralMode === 'senado_2024'
                      ? (electoralDataSenado[sec.seccion] === undefined && _at !== undefined && electoralDataSenado[_at] !== undefined)
                      : electoralMode === 'dip_2024'
                        ? (electoralDataDip2024[sec.seccion] === undefined && _at !== undefined && electoralDataDip2024[_at] !== undefined)
                        : false;
            // Suppressed: group label handles aliased sections
            if (isAliased && electoralMode) return null;
            // Sector 8 has too many sections — labels overlap; rely on hover + dashboard list
            if (sec.pologono === 8 && !isSelected) return null;
            // Below zoom 14 only render the selected section label to avoid overlap
            if (currentZoom < 14 && !isSelected) return null;
            const fontSize = Math.max(10, Math.min(14, currentZoom));
            return (
              <OverlayView
                key={`lbl-sec-${sec.id ?? idx}`}
                position={center}
                mapPaneName="floatPane"
              >
                <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
                  {isSelected ? (
                    // Selected: amber pill with stronger glow
                    <span style={{
                      display: 'inline-block',
                      fontSize,
                      fontWeight: 800,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                      padding: '3px 9px',
                      borderRadius: 7,
                      color: '#7c2d12',
                      background: 'rgba(251,191,36,0.98)',
                      border: '1.5px solid rgba(180,83,9,0.45)',
                      boxShadow: '0 2px 8px rgba(180,83,9,0.28), 0 0 0 2.5px rgba(251,191,36,0.22)',
                    }}>
                      {sec.seccion}
                    </span>
                  ) : (
                    // Normal/compact: crisp pill — minimal at low zoom, full at high zoom
                    <span style={{
                      display: 'inline-block',
                      fontSize,
                      fontWeight: 700,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.01em',
                      padding: '2.5px 7px',
                      borderRadius: 6,
                      color: isDark ? '#f1f5f9' : '#1e293b',
                      background: isDark ? 'rgba(2,6,23,0.88)' : 'rgba(255,255,255,0.95)',
                      border: isDark ? '1px solid rgba(255,255,255,0.13)' : '1px solid rgba(15,23,42,0.16)',
                      boxShadow: isDark
                        ? '0 1px 5px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.04)'
                        : '0 1px 5px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
                    }}>
                      {sec.seccion}
                    </span>
                  )}
                </div>
              </OverlayView>
            );
          })}

          {/* ── Etiquetas de sector (municipio y distrito) ──────────── */}
          {(() => {
            const uniqueSectors = [...new Set(secciones.map(s => s.pologono))].filter(Boolean);
            if (uniqueSectors.length <= 1) return null;
            return uniqueSectors.map(sector => {
              const secsInSector = secciones.filter(s => s.pologono === sector);
              const centroids = secsInSector
                .map(s => { const p = parseWKT(s.geometry); return p.length ? getCenter(p) : null; })
                .filter(Boolean);
              if (!centroids.length) return null;
              const lat = centroids.reduce((s, c) => s + c.lat, 0) / centroids.length;
              const lng = centroids.reduce((s, c) => s + c.lng, 0) / centroids.length;
              const color = sectorColorMap[sector] ?? SECTOR_COLORS[0];
              return (
                <OverlayView
                  key={`lbl-sector-${sector}`}
                  position={{ lat, lng }}
                  mapPaneName="floatPane"
                >
                  <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.01em',
                      padding: '2.5px 7px',
                      borderRadius: 6,
                      color: isDark ? '#f1f5f9' : '#1e293b',
                      background: isDark ? 'rgba(2,6,23,0.88)' : 'rgba(255,255,255,0.95)',
                      border: isDark ? '1px solid rgba(255,255,255,0.13)' : '1px solid rgba(15,23,42,0.16)',
                      boxShadow: isDark
                        ? '0 1px 5px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.04)'
                        : '0 1px 5px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
                    }}>
                      Sector {sector}
                    </span>
                  </div>
                </OverlayView>
              );
            });
          })()}

          {/* ── Etiquetas de grupo (secciones históricas aliased) ───── */}
          {electoralMode && currentZoom >= 14 && (() => {
            // Group aliased sections by their alias target and compute a shared centroid
            const groups = {};
            for (const sec of secciones) {
              const alias = SECTION_ALIASES[sec.seccion];
              if (!alias) continue;
              const dataSource = electoralMode === 'ayu_2021_ieem' ? electoralDataIEEM
                               : electoralMode === 'ayu_2024'      ? electoralData2024
                               : electoralMode === 'ayu_2024_ieem' ? electoralData2024IEEM
                               : electoralMode === 'senado_2024'   ? electoralDataSenado
                               : electoralMode === 'dip_2024'      ? electoralDataDip2024
                               : electoralData;
              if (dataSource[sec.seccion] !== undefined) continue; // has own data, not aliased
              if (dataSource[alias] === undefined) continue; // alias target also missing, skip
              const paths = parseWKT(sec.geometry);
              if (!paths.length) continue;
              const c = getCenter(paths);
              if (!groups[alias]) groups[alias] = { lats: [], lngs: [], count: 0 };
              groups[alias].lats.push(c.lat);
              groups[alias].lngs.push(c.lng);
              groups[alias].count++;
            }
            return Object.entries(groups).map(([alias, g]) => {
              const lat = g.lats.reduce((s, v) => s + v, 0) / g.lats.length;
              const lng = g.lngs.reduce((s, v) => s + v, 0) / g.lngs.length;
              return (
                <OverlayView
                  key={`lbl-alias-${alias}`}
                  position={{ lat, lng }}
                  mapPaneName="floatPane"
                >
                  <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: Math.max(8, Math.min(11, currentZoom - 2)),
                      fontWeight: 800,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      letterSpacing: '.03em',
                      lineHeight: 1.35,
                      whiteSpace: 'nowrap',
                      padding: '2px 5px',
                      borderRadius: 4,
                      color: isDark ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.85)',
                      background: isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.88)',
                      border: isDark ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(0,0,0,0.18)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                    }}>
                      <span style={{ opacity: 0.6, fontSize: '0.85em' }}>hist.</span>
                      {alias}
                    </span>
                  </div>
                </OverlayView>
              );
            });
          })()}

          {/* ── Polígonos de fracciones (desde tabla fracciones) ───── */}
          {fraccionesGeo.map((f) => {
            const paths = parseWKT(f.geometry);
            if (!paths.length) return null;
            const { fill, stroke } = fracColor(f);
            const isFocused  = focusCoords?.ubt === f.fraccion;
            const isHovered  = hovered?.tipo === 'fraccion' && hovered?.data?.fraccion === f.fraccion;
            const isAssigned = editableLocation != null && assignedFraccion === f.fraccion;
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
                      fillColor:    isAssigned ? '#DC2626' : fill,
                      strokeColor:  isAssigned ? '#7F1D1D' : isFocused ? '#92400E' : isHovered ? '#111827' : stroke,
                      fillOpacity:  isAssigned ? 0.55 : isFocused ? 0.65 : isHovered ? 0.70 : 0.48,
                      strokeWeight: isAssigned ? 4    : isFocused ? 3.5  : isHovered ? 3    : 2.2,
                      strokeOpacity: 1,
                      zIndex:       isAssigned ? 35   : isFocused ? 30   : isHovered ? 25   : 12,
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
            />
          ))}

          {/* ── Card de contacto SM ──────────────────────────────────── */}
          {activeMarker && (() => {
            const m = activeMarker;
            const hasPhoto = Boolean(m.url_foto_perfil);
            const fullName = [m.nombre, m.a_paterno, m.a_materno].filter(Boolean).join(' ');
            const accent   = getPuestoColor(m.puesto);
            const cardBg   = isDark ? '#1e293b' : '#ffffff';
            const labelClr = isDark ? '#94a3b8' : '#64748b';
            const valueClr = isDark ? '#f1f5f9' : '#0f172a';
            const divClr   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
            const hdrBg    = isDark
              ? 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)'
              : 'linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%)';
            return (
              <OverlayView
                key={`card-mk-${m.id}`}
                position={{ lat: Number(m.latitud), lng: Number(m.longitud) }}
                mapPaneName="floatPane"
              >
                <div style={{ position: 'absolute', transform: 'translate(-50%, calc(-100% - 12px))', pointerEvents: 'none' }}>
                  <div style={{
                    width: 192,
                    background: cardBg,
                    borderRadius: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14)',
                    overflow: 'hidden',
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                    pointerEvents: 'auto',
                  }}>
                    {/* Header — foto de fondo o placeholder azul */}
                    <div style={{ position: 'relative', height: 130, background: hdrBg, overflow: 'hidden' }}>
                      {hasPhoto && (
                        <img
                          src={m.url_foto_perfil} alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                        />
                      )}
                      {/* Silueta centrada cuando no hay foto */}
                      {!hasPhoto && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="4.5" fill="rgba(255,255,255,0.22)"/>
                            <path d="M3 21c0-4.5 4-8 9-8s9 3.5 9 8" stroke="rgba(255,255,255,0.22)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                          </svg>
                          <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sin foto</span>
                        </div>
                      )}
                      {/* Gradiente inferior para legibilidad del texto */}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.10) 55%, transparent 100%)' }} />
                      {/* Close */}
                      <button
                        onClick={() => setActiveMarker(null)}
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 22, height: 22, borderRadius: 11,
                          background: 'rgba(0,0,0,0.32)',
                          border: '1px solid rgba(255,255,255,0.22)',
                          color: '#fff', fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1, padding: 0,
                        }}
                      >×</button>
                      {/* Nombre + badge sobre la foto */}
                      <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, lineHeight: 1.3, margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{fullName}</p>
                        {m.puesto && (
                          <span style={{
                            display: 'inline-block', marginTop: 4,
                            background: accent, color: '#fff',
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                            padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase',
                          }}>{m.puesto}</span>
                        )}
                      </div>
                    </div>
                    {/* Body */}
                    <div style={{ padding: '9px 12px 11px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[
                        { label: 'Sección',  value: m.seccion },
                        { label: 'Fracción', value: m.ubt },
                      ].filter(r => r.value != null).map(({ label, value }, i, arr) => (
                        <div key={label} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          fontSize: 11, padding: '5px 0',
                          borderBottom: i < arr.length - 1 ? `1px solid ${divClr}` : 'none',
                        }}>
                          <span style={{ color: labelClr }}>{label}</span>
                          <span style={{ color: valueClr, fontWeight: 600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Flecha */}
                  <div style={{
                    width: 0, height: 0, margin: '0 auto',
                    borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent',
                    borderTop: `8px solid ${cardBg}`,
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.12))',
                  }} />
                </div>
              </OverlayView>
            );
          })()}

          {/* ── Casillas PJEM ────────────────────────────────────────── */}
          {casillasVisibles.map((c) => (
            <Marker
              key={`casilla-${c.seccion}`}
              position={{ lat: Number(c.lat), lng: Number(c.lng) }}
              icon={urnaIcon}
              zIndex={40}
              onClick={() => setActiveCasilla(activeCasilla?.seccion === c.seccion ? null : c)}
            />
          ))}

          {/* ── Card Google Maps-style para casilla activa ───────────── */}
          {activeCasilla && (() => {
            const c = activeCasilla;
            const pinH = CASILLA_SIZES[casillaTier][1];
            const parsed = parseCasillaUbicacion(c.ubicacion);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
            const dirUrl  = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
            const svUrl   = `https://maps.googleapis.com/maps/api/streetview?size=576x292&location=${c.lat},${c.lng}&fov=80&pitch=5&key=${GOOGLE_API_KEY}`;
            const cardStyle = {
              width: 288,
              background: '#fff',
              borderRadius: 12,
              overflow: 'hidden',
              fontFamily: 'system-ui,-apple-system,sans-serif',
            };
            const btnBase = {
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 8px', textDecoration: 'none', color: '#1a73e8',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', cursor: 'pointer',
              background: 'transparent', border: 'none',
            };
            return (
              <OverlayView
                key={`gmcard-${c.seccion}`}
                position={{ lat: Number(c.lat), lng: Number(c.lng) }}
                mapPaneName="floatPane"
              >
                <div style={{
                  position: 'absolute',
                  transform: `translate(-50%, calc(-100% - ${pinH + 10}px))`,
                  zIndex: 200,
                  filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.28))',
                }}>
                  <div style={cardStyle}>

                    {/* ── Foto Street View ── */}
                    <div style={{ position: 'relative', height: 148, background: 'linear-gradient(135deg,#fef3c7,#fde68a)' }}>
                      <img
                        src={svUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.38) 0%,transparent 52%)' }} />
                      {/* Casillas badge */}
                      <div style={{
                        position: 'absolute', bottom: 10, left: 10,
                        background: '#F59E0B', color: '#78350f',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                        padding: '3px 8px', borderRadius: 20,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                      }}>
                        {c.casillas} {c.casillas === 1 ? 'casilla' : 'casillas'}
                      </div>
                      {/* Sector badge */}
                      {c.poligono && (
                        <div style={{
                          position: 'absolute', bottom: 10, right: 40,
                          background: 'rgba(0,0,0,0.50)', color: '#fff',
                          fontSize: 10, fontWeight: 600,
                          padding: '3px 7px', borderRadius: 20,
                        }}>
                          Sector {c.poligono}
                        </div>
                      )}
                      {/* Close button */}
                      <button
                        onClick={() => setActiveCasilla(null)}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.45)', border: 'none',
                          color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, lineHeight: 1,
                        }}
                        aria-label="Cerrar"
                      >✕</button>
                    </div>

                    {/* ── Cuerpo de información ── */}
                    <div style={{ padding: '12px 14px 6px' }}>
                      <p style={{
                        margin: '0 0 2px', fontSize: 14, fontWeight: 700,
                        color: '#1a1a1a', lineHeight: 1.35,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {parsed.nombre || 'Casilla Electoral'}
                      </p>
                      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#70757a', lineHeight: 1.3 }}>
                        Casilla Electoral · Sección {c.seccion}
                      </p>

                      {/* Dirección */}
                      {parsed.calle && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.8 4.5 8.5 4.5 8.5S12.5 9.8 12.5 6c0-2.5-2-4.5-4.5-4.5z" fill="#70757a"/>
                            <circle cx="8" cy="6" r="1.8" fill="white"/>
                          </svg>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12, color: '#3c4043', lineHeight: 1.4 }}>{parsed.calle}</p>
                            {parsed.colonia && (
                              <p style={{ margin: 0, fontSize: 11, color: '#70757a', lineHeight: 1.35 }}>
                                {parsed.colonia}{parsed.cp ? `, CP ${parsed.cp}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Referencia entre calles */}
                      {parsed.referencia && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                            <circle cx="8" cy="8" r="5.5" stroke="#70757a" strokeWidth="1.5"/>
                            <path d="M8 5v3" stroke="#70757a" strokeWidth="1.5" strokeLinecap="round"/>
                            <circle cx="8" cy="10.5" r="0.75" fill="#70757a"/>
                          </svg>
                          <p style={{ margin: 0, fontSize: 11, color: '#70757a', lineHeight: 1.4, fontStyle: 'italic' }}>
                            {parsed.referencia}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── Divisor ── */}
                    <div style={{ height: 1, background: '#e8eaed', margin: '2px 14px 0' }} />

                    {/* ── Botones de acción ── */}
                    <div style={{ display: 'flex' }}>
                      <a href={dirUrl} target="_blank" rel="noopener noreferrer"
                        style={{ ...btnBase, borderRadius: '0 0 0 12px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0f6ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 3L4.5 20 12 16.5 19.5 20 12 3z" fill="#1a73e8"/>
                        </svg>
                        Cómo llegar
                      </a>
                      <div style={{ width: 1, background: '#e8eaed', margin: '8px 0' }} />
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                        style={{ ...btnBase, borderRadius: '0 0 12px 0' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0f6ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z" fill="#1a73e8"/>
                          <circle cx="12" cy="9" r="2.5" fill="white"/>
                        </svg>
                        Ver en Maps
                      </a>
                    </div>
                  </div>

                  {/* Flecha apuntando al pin */}
                  <div style={{
                    width: 0, height: 0, margin: '0 auto',
                    borderLeft: '9px solid transparent',
                    borderRight: '9px solid transparent',
                    borderTop: '9px solid #fff',
                  }} />
                </div>
              </OverlayView>
            );
          })()}

          {/* ── Etiquetas de sección sobre casilla (zoom ≥ 15) ──────── */}
          {showCasillasPjem && currentZoom >= 15 && casillasVisibles.map((c) => {
            const pinH = CASILLA_SIZES[casillaTier][1];
            return (
              <OverlayView
                key={`lbl-cas-${c.seccion}`}
                position={{ lat: Number(c.lat), lng: Number(c.lng) }}
                mapPaneName="floatPane"
              >
                <div style={{
                  position: 'absolute',
                  transform: `translate(-50%, calc(-100% - ${pinH + 4}px))`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'system-ui,-apple-system,sans-serif',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    padding: '2px 5px',
                    borderRadius: 4,
                    color: '#78350f',
                    background: 'rgba(254,243,199,0.97)',
                    border: '1px solid rgba(217,119,6,0.30)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  }}>
                    §{c.seccion}
                  </span>
                </div>
              </OverlayView>
            );
          })}

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

          {/* ── Marcador editable (arrastrable) ─────────────────────── */}
          {editableLocation && window.google && (
            <Marker
              position={editableLocation}
              draggable={!!onEditableLocationChange}
              onDragEnd={handleEditableMarkerDragEnd}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#DC2626',
                fillOpacity: 0.95,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              zIndex={60}
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
            electoral={electoralMode && hovered.tipo === 'seccion'
              ? (electoralMode === 'ayu_2021_ieem'  ? getElectoralResultIEEM(hovered.data?.seccion)
               : electoralMode === 'ayu_2024'       ? getElectoralResult2024(hovered.data?.seccion)
               : electoralMode === 'ayu_2024_ieem'  ? getElectoralResult2024IEEM(hovered.data?.seccion)
               : electoralMode === 'senado_2024'    ? getElectoralResultSenado(hovered.data?.seccion)
               : electoralMode === 'dip_2024'       ? getElectoralResultDip2024(hovered.data?.seccion)
               : getElectoralResult(hovered.data?.seccion))
              : null}
          />
        )}
      </div>

      {/* ── Pie: leyenda ────────────────────────────────────────────────── */}
      <div className={`no-print flex-shrink-0 px-4 py-2.5 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        {onEditableLocationChange && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-600 border-2 border-red-900 flex-shrink-0" />
            <span className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {assignedFraccion != null ? `Fracción asignada: ${assignedFraccion}` : 'Sin fracción asignada'}
            </span>
          </div>
        )}

        {electoralMode ? (
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`text-xs font-semibold mr-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {electoralMode === 'ayu_2021_ieem' ? 'Ayuntamiento 2021 — IEEM'
               : electoralMode === 'ayu_2024'    ? 'Ayuntamiento 2024 — Rosi Wong'
               : electoralMode === 'senado_2024' ? 'Senaduría 2024 — Mariela Gutiérrez'
               : electoralMode === 'dip_2024'    ? 'Diputación Local 2024 — Interno'
               : 'Ayuntamiento 2021 — interno'}
            </span>
            {electoralMode === 'ayu_2024'
              ? Object.entries(PARTY_COLORS_2024).map(([key, c]) => {
                  const count = Object.values(electoralData2024).filter(d => d.ganador === key).length;
                  if (!count) return null;
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.fill, border: `1.5px solid ${c.stroke}` }} />
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{c.label} <span className="opacity-60">({count})</span></span>
                    </div>
                  );
                })
              : electoralMode === 'senado_2024'
                ? Object.entries(PARTY_COLORS_SENADO).map(([key, c]) => {
                    const count = Object.values(electoralDataSenado).filter(d => d.ganador === key).length;
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.fill, border: `1.5px solid ${c.stroke}` }} />
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{c.label} <span className="opacity-60">({count})</span></span>
                      </div>
                    );
                  })
                : electoralMode === 'dip_2024'
                ? Object.entries(PARTY_COLORS_DIP).map(([key, c]) => {
                    const count = Object.values(electoralDataDip2024).filter(d => d.ganador === key).length;
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.fill, border: `1.5px solid ${c.stroke}` }} />
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{c.label} <span className="opacity-60">({count})</span></span>
                      </div>
                    );
                  })
                : Object.entries(PARTY_COLORS).map(([party, c]) => {
                    const dataSource = electoralMode === 'ayu_2021_ieem' ? electoralDataIEEM : electoralData;
                    const count = Object.values(dataSource).filter(d => d.ganador_partido === party).length;
                    if (!count) return null;
                    return (
                      <div key={party} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.fill, border: `1.5px solid ${c.stroke}` }} />
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{party} <span className="opacity-60">({count})</span></span>
                      </div>
                    );
                  })
            }
            {(electoralMode === 'ayu_2021_ieem' || electoralMode === 'ayu_2024' || electoralMode === 'senado_2024') && (
              <div className="flex items-center gap-1.5 ml-2">
                <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-400" style={{ border: '2px solid #FFFFFF', outline: '1px solid #9CA3AF' }} />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sec. fraccionada</span>
              </div>
            )}
          </div>
        ) : (
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
        )}

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
            {showCasillasPjem && casillasVisibles.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className={`${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  <BallotSvg size={13} />
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {casillasVisibles.length} casillas PJEM
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
