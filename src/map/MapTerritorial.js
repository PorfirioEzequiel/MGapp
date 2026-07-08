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
  SP:        '#7C3AED',
  SECCIONAL: '#DB2777',
  SM:        '#2563EB',
  MOVILIZADOR: '#059669',
  INVITADO:  '#6B7280',
};
const getPuestoColor = (puesto) =>
  PUESTO_COLOR[(puesto || '').toUpperCase()] ?? '#6B7280';

// ── Estilos de mapa ──────────────────────────────────────────────────────────
const MAP_STYLE_DEFS = {
  claro: {
    label: 'Claro',
    mapTypeId: 'roadmap',
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
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
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
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
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ visibility: 'on', color: '#888' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ visibility: 'on', color: '#fff' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
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

// ── Parser WKT robusto ────────────────────────────────────────────────────────
const parseWKT = (wkt) => {
  if (!wkt) return [];
  const s = String(wkt).trim();
  const parseCoords = (str) =>
    str.trim().split(',').map(coord => {
      const parts = coord.trim().split(/\s+/);
      return { lat: Number(parts[1]), lng: Number(parts[0]) };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

  const groups = [];
  const regex = /\(\(([^()]+)\)\)/g;
  let m;
  while ((m = regex.exec(s)) !== null) {
    const pts = parseCoords(m[1]);
    if (pts.length > 0) groups.push(pts);
  }
  if (groups.length > 0) return groups;

  const inner = s
    .replace(/MULTIPOLYGON\s*\(\(\(/, '').replace(/\)\)\)$/, '')
    .replace(/POLYGON\s*\(\(/, '').replace(/\)\)$/, '');
  const fb = parseCoords(inner);
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

// ── Componente ────────────────────────────────────────────────────────────────
const MapTerritorial = ({
  secciones = [],
  ciudadanos = [],
  selectedSeccion,
  onSelectSeccion,
}) => {
  const mapRef = useRef(null);
  const [activeSeccion, setActiveSeccion] = useState(null);
  const [activeMarker, setActiveMarker]   = useState(null);
  const [sectorColorMap, setSectorColorMap] = useState({});
  const [currentStyle, setCurrentStyle]   = useState('claro');
  const isDark = currentStyle === 'oscuro';

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_API_KEY });

  // Color map by sector
  useEffect(() => {
    const map = {};
    const sectors = [...new Set(secciones.map(s => s.pologono))].sort((a, b) => a - b);
    sectors.forEach((s, i) => { map[s] = SECTOR_COLORS[i % SECTOR_COLORS.length]; });
    setSectorColorMap(map);
  }, [secciones]);

  // Auto-fit bounds when displayed secciones change
  useEffect(() => {
    if (!mapRef.current || !secciones.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let has = false;
    secciones.forEach(sec => {
      parseWKT(sec.geometry).flat().forEach(p => { bounds.extend(p); has = true; });
    });
    if (has) mapRef.current.fitBounds(bounds, 32);
  }, [secciones]);

  // Clear active info when selection changes
  useEffect(() => { setActiveSeccion(null); setActiveMarker(null); }, [selectedSeccion]);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Create circle icon for markers
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

  const styleDef = MAP_STYLE_DEFS[currentStyle];

  if (!isLoaded) return (
    <div className="flex items-center justify-center bg-gray-100 rounded-xl h-full min-h-[400px]">
      <p className="text-gray-400 text-sm">Cargando mapa...</p>
    </div>
  );

  // Ciudadanos con latitud/longitud válidos
  const markers = ciudadanos.filter(c => c.latitud && c.longitud &&
    !isNaN(Number(c.latitud)) && !isNaN(Number(c.longitud)) &&
    Number(c.latitud) !== 0 && Number(c.longitud) !== 0
  );

  // Ciudadanos con geometría de fracción
  const fraccionPolygons = ciudadanos.filter(c => c.geometry);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden shadow-lg border border-gray-200">

      {/* Área del mapa — ocupa todo el espacio disponible */}
      <div className="relative flex-1 min-h-[400px]">

      {/* Selector de capa — flotante sobre el mapa */}
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
        {/* ── Polígonos de secciones ──────────────────────────────────── */}
        {secciones.map((sec, idx) => {
          const paths = parseWKT(sec.geometry);
          if (!paths.length) return null;
          const color = sectorColorMap[sec.pologono] || SECTOR_COLORS[0];
          const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;

          return (
            <React.Fragment key={sec.id ?? idx}>
              {paths.map((ring, ri) => (
                <Polygon
                  key={`sec-${sec.id}-${ri}`}
                  paths={ring}
                  onClick={() => {
                    setActiveSeccion(sec);
                    onSelectSeccion?.(sec);
                  }}
                  options={{
                    fillColor: isSelected ? '#FBBF24' : color.fill,
                    strokeColor: isSelected ? '#92400E' : color.stroke,
                    fillOpacity: isSelected ? 0.72 : isDark ? 0.55 : 0.38,
                    strokeWeight: isSelected ? 3 : 1.5,
                    zIndex: isSelected ? 20 : 1,
                  }}
                />
              ))}

              {activeSeccion?.seccion === sec.seccion && (
                <InfoWindow
                  position={getCenter(paths)}
                  onCloseClick={() => setActiveSeccion(null)}
                >
                  <div className="min-w-[200px] font-sans text-gray-800">
                    <p className="font-bold text-sm mb-1">Sección {sec.seccion}</p>
                    <p className="text-xs text-gray-500">Distrito: <span className="font-medium text-gray-700">{sec.distrito_federal}</span></p>
                    <p className="text-xs text-gray-500">Sector: <span className="font-medium text-gray-700">{sec.pologono}</span></p>
                    {sec.lista_nominal != null && (
                      <p className="text-xs mt-1">
                        Lista nominal:{' '}
                        <span className="font-semibold text-blue-700">{Number(sec.lista_nominal).toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}

        {/* ── Polígonos de fracciones (desde ciudadania) ───────────────── */}
        {fraccionPolygons.map((c) => {
          const paths = parseWKT(c.geometry);
          if (!paths.length) return null;
          return (
            <React.Fragment key={`frac-${c.id}`}>
              {paths.map((ring, ri) => (
                <Polygon
                  key={`frac-${c.id}-${ri}`}
                  paths={ring}
                  options={{
                    fillColor: '#34D399',
                    strokeColor: '#059669',
                    fillOpacity: 0.25,
                    strokeWeight: 2,
                    strokeOpacity: 0.85,
                    zIndex: 5,
                    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 }, offset: '0', repeat: '12px' }],
                  }}
                />
              ))}
            </React.Fragment>
          );
        })}

        {/* ── Marcadores ciudadanos ────────────────────────────────────── */}
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
                  {c.ubt && <p className="text-gray-500">Fracción: <span className="font-medium text-gray-700">{c.ubt}</span></p>}
                  {c.seccion && <p className="text-gray-500">Sección: <span className="font-medium text-gray-700">{c.seccion}</span></p>}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
      </div>{/* fin área mapa */}

      {/* ── Pie: leyenda de sectores + contadores ─────────────────────── */}
      <div className={`flex-shrink-0 px-4 py-2.5 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'}`}>
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
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{markers.length} ub. registradas</span>
              </div>
            )}
            {fraccionPolygons.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-3 rounded-sm border-2 border-emerald-500 bg-emerald-100" />
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{fraccionPolygons.length} fracc. mapeadas</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapTerritorial;
