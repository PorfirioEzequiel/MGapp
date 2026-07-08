import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow } from '@react-google-maps/api';

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

// ── Tooltip de hover ──────────────────────────────────────────────────────────
const HoverTooltip = ({ data, pos, containerRef, isDark, tipo = 'seccion' }) => {
  if (!data || !containerRef.current) return null;

  const containerW = containerRef.current.offsetWidth;
  const containerH = containerRef.current.offsetHeight;
  const tooltipW   = 240;
  const tooltipH   = 220;

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

  const bg     = isDark ? 'bg-gray-900 border-gray-700'   : 'bg-white border-gray-200';
  const title  = isDark ? 'text-white'                    : 'text-gray-900';
  const sub    = isDark ? 'text-gray-400'                 : 'text-gray-500';
  const val    = isDark ? 'text-gray-100'                 : 'text-gray-800';

  const Row = ({ label, value, accent }) => {
    if (value == null) return null;
    return (
      <div className="flex justify-between items-center gap-2 py-0.5">
        <span className={`text-xs ${sub}`}>{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${accent ? 'text-blue-500' : val}`}>
          {value}
        </span>
      </div>
    );
  };

  // Datos electorales disponibles en la sección
  const listaNominal = fmt(data.lista_nominal);
  const padron       = fmt(data.padron ?? data.padron_electoral);
  const hombres      = fmt(data.hombres ?? data.total_hombres);
  const mujeres      = fmt(data.mujeres ?? data.total_mujeres);
  const pctH = (data.hombres && data.lista_nominal)
    ? `${((data.hombres / data.lista_nominal) * 100).toFixed(1)}%` : null;
  const pctM = (data.mujeres && data.lista_nominal)
    ? `${((data.mujeres / data.lista_nominal) * 100).toFixed(1)}%` : null;

  if (tipo === 'fraccion') {
    return (
      <div style={style} className={`rounded-xl border shadow-2xl p-3 ${bg}`}>
        <p className={`text-sm font-bold mb-1.5 ${title}`}>Fracción {data.ubt}</p>
        <div className="space-y-0.5">
          <Row label="Sección"  value={data.seccion} />
          <Row label="Promotor SM" value={[data.nombre, data.a_paterno, data.a_materno].filter(Boolean).join(' ') || '—'} />
        </div>
      </div>
    );
  }

  return (
    <div style={style} className={`rounded-xl border shadow-2xl p-3 ${bg}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-2 pb-2 border-b border-gray-200/30">
        <div>
          <p className={`text-sm font-bold leading-tight ${title}`}>Sección {data.seccion}</p>
          <p className={`text-xs ${sub}`}>Sector {data.pologono} · Distrito {data.distrito_federal}</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
          Sec. {data.seccion}
        </span>
      </div>

      {/* Datos electorales */}
      <div className="space-y-0.5">
        <Row label="Lista nominal"       value={listaNominal} accent />
        <Row label="Padrón electoral"    value={padron} />
        {hombres && mujeres ? (
          <>
            <div className="mt-1.5 mb-0.5">
              <div className={`text-xs font-medium ${sub} mb-1`}>Distribución por género</div>
              {/* Barra de progreso hombres/mujeres */}
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-gray-200">
                {data.hombres && data.lista_nominal && (
                  <>
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${(data.hombres / data.lista_nominal) * 100}%` }}
                    />
                    <div
                      className="h-full bg-pink-400"
                      style={{ width: `${(data.mujeres / data.lista_nominal) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex justify-between mt-1">
                <span className={`text-xs ${sub}`}>♂ {hombres} <span className="text-gray-400">({pctH})</span></span>
                <span className={`text-xs ${sub}`}>♀ {mujeres} <span className="text-gray-400">({pctM})</span></span>
              </div>
            </div>
          </>
        ) : (
          <>
            <Row label="Hombres" value={hombres} />
            <Row label="Mujeres" value={mujeres} />
          </>
        )}
      </div>

      <p className={`text-xs mt-2 pt-1.5 border-t border-gray-200/30 ${sub}`}>
        Clic para seleccionar sección
      </p>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const MapTerritorial = ({
  secciones = [],
  ciudadanos = [],
  selectedSeccion,
  onSelectSeccion,
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

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Seguimiento de mouse sobre el contenedor del mapa
  const handleContainerMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Handlers de polígono
  const onPolyMouseOver = useCallback((sec) => {
    setHovered({ data: sec, tipo: 'seccion' });
  }, []);

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

  const markers          = ciudadanos.filter(c =>
    c.latitud && c.longitud && !isNaN(Number(c.latitud)) && !isNaN(Number(c.longitud)) &&
    Number(c.latitud) !== 0 && Number(c.longitud) !== 0
  );
  const fraccionPolygons = ciudadanos.filter(c => c.geometry);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden shadow-lg border border-gray-200">

      {/* ── Área del mapa ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[400px]"
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Selector de capa flotante */}
        <div className="absolute top-3 left-3 z-10 flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-200">
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
          {secciones.map((sec, idx) => {
            const paths     = parseWKT(sec.geometry);
            if (!paths.length) return null;
            const color     = sectorColorMap[sec.pologono] || SECTOR_COLORS[0];
            const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;
            const isHovered  = hovered?.tipo === 'seccion' && hovered?.data?.seccion === sec.seccion;

            return (
              <React.Fragment key={sec.id ?? idx}>
                {paths.map((ring, ri) => (
                  <Polygon
                    key={`sec-${sec.id}-${ri}`}
                    paths={ring}
                    onMouseOver={() => onPolyMouseOver(sec)}
                    onMouseMove={onPolyMouseMove}
                    onMouseOut={onPolyMouseOut}
                    onClick={() => onSelectSeccion?.(sec)}
                    options={{
                      fillColor:    isSelected ? '#FBBF24' : color.fill,
                      strokeColor:  isSelected ? '#92400E' : isHovered ? '#1e1e1e' : color.stroke,
                      fillOpacity:  isSelected ? 0.75 : isHovered ? 0.65 : isDark ? 0.50 : 0.38,
                      strokeWeight: isSelected ? 3     : isHovered ? 2.5 : 1.5,
                      zIndex:       isSelected ? 20    : isHovered ? 10  : 1,
                    }}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* ── Polígonos de fracciones (desde ciudadania) ──────────── */}
          {fraccionPolygons.map((c) => {
            const paths = parseWKT(c.geometry);
            if (!paths.length) return null;
            return (
              <React.Fragment key={`frac-${c.id}`}>
                {paths.map((ring, ri) => (
                  <Polygon
                    key={`frac-${c.id}-${ri}`}
                    paths={ring}
                    onMouseOver={() => onFracMouseOver(c)}
                    onMouseMove={onPolyMouseMove}
                    onMouseOut={onPolyMouseOut}
                    options={{
                      fillColor:    '#34D399',
                      strokeColor:  '#059669',
                      fillOpacity:  0.22,
                      strokeWeight: 2,
                      strokeOpacity: 0.85,
                      zIndex: 5,
                    }}
                  />
                ))}
              </React.Fragment>
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
        </GoogleMap>

        {/* ── Tooltip dinámico de hover ───────────────────────────────── */}
        {hovered && (
          <HoverTooltip
            data={hovered.data}
            tipo={hovered.tipo}
            pos={tooltipPos}
            containerRef={containerRef}
            isDark={isDark}
          />
        )}
      </div>

      {/* ── Pie: leyenda ────────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-4 py-2.5 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
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

        {(markers.length > 0 || fraccionPolygons.length > 0) && (
          <div className="flex gap-3 ml-auto">
            {markers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {markers.length} ub. registradas
                </span>
              </div>
            )}
            {fraccionPolygons.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-3 rounded-sm border-2 border-emerald-500 bg-emerald-100" />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {fraccionPolygons.length} fracc. mapeadas
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapTerritorial;
