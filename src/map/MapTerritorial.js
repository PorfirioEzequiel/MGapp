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
                🗳 Ayuntamiento 2021 - interno
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
                🗳 Ayuntamiento 2021 - IEEM
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
                🗳 Ayuntamiento 2024 - Rosi Wong
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
                🗳 Ayuntamiento 2024 - IEEM
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
                🗳 Senaduría 2024 - Mariela Gutiérrez
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
                🗳 Diputación Local 2024 - Interno
              </button>
            </>
          )}
        </div>

        {/* Botones de exportación (solo cuando no hay modo editable) */}
        {!onEditableLocationChange && (
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
          {currentZoom >= 13 && secciones.map((sec, idx) => {
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
            const fontSize = Math.max(9, Math.min(13, currentZoom - 1));
            return (
              <OverlayView
                key={`lbl-sec-${sec.id ?? idx}`}
                position={center}
                mapPaneName="floatPane"
              >
                <div style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', userSelect: 'none' }}>
                  {isSelected ? (
                    // Selected: amber pill with border
                    <span style={{
                      display: 'inline-block',
                      fontSize,
                      fontWeight: 800,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      padding: '3px 7px',
                      borderRadius: 5,
                      color: '#78350f',
                      background: 'rgba(251,191,36,0.98)',
                      border: '1.5px solid rgba(120,53,15,0.5)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}>
                      {sec.seccion}
                    </span>
                  ) : (
                    // Normal: crisp white pill with dark text, always readable over any polygon color
                    <span style={{
                      display: 'inline-block',
                      fontSize,
                      fontWeight: 700,
                      fontFamily: 'system-ui,-apple-system,sans-serif',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      background: isDark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.96)',
                      border: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.22)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                    }}>
                      {sec.seccion}
                    </span>
                  )}
                </div>
              </OverlayView>
            );
          })}

          {/* ── Etiquetas de grupo (secciones históricas aliased) ───── */}
          {electoralMode && currentZoom >= 12 && (() => {
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
          </div>
        )}
      </div>
      </div>

      <PrintFooter ctx={printContext} />
    </div>
  );
};

export default MapTerritorial;
