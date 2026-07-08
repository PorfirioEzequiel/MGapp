import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, InfoWindow } from '@react-google-maps/api';

const GOOGLE_API_KEY = 'AIzaSyCq9lepK0chTwx6vDjQlCftmP-IpCSBuPM';
const DEFAULT_CENTER = { lat: 19.66, lng: -98.99 };

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
  let match;
  while ((match = regex.exec(s)) !== null) {
    const pts = parseCoords(match[1]);
    if (pts.length > 0) groups.push(pts);
  }
  if (groups.length > 0) return groups;

  // Fallback
  const inner = s
    .replace(/MULTIPOLYGON\s*\(\(\(/, '')
    .replace(/\)\)\)$/, '')
    .replace(/POLYGON\s*\(\(/, '')
    .replace(/\)\)$/, '');
  const fallback = parseCoords(inner);
  return fallback.length ? [fallback] : [];
};

const getCenter = (pathGroups) => {
  const all = pathGroups.flat();
  if (!all.length) return DEFAULT_CENTER;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
};

const MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
  styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
};

const MapTerritorial = ({ secciones = [], selectedSeccion, onSelectSeccion }) => {
  const mapRef = useRef(null);
  const [activeInfo, setActiveInfo] = useState(null);
  const [sectorColorMap, setSectorColorMap] = useState({});

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_API_KEY });

  useEffect(() => {
    const map = {};
    const sectors = [...new Set(secciones.map(s => s.pologono))].sort((a, b) => a - b);
    sectors.forEach((sec, i) => { map[sec] = SECTOR_COLORS[i % SECTOR_COLORS.length]; });
    setSectorColorMap(map);
  }, [secciones]);

  useEffect(() => {
    if (!mapRef.current || !secciones.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    secciones.forEach(sec => {
      parseWKT(sec.geometry).flat().forEach(p => {
        bounds.extend(p);
        hasPoints = true;
      });
    });
    if (hasPoints) mapRef.current.fitBounds(bounds, 24);
  }, [secciones]);

  useEffect(() => {
    setActiveInfo(null);
  }, [selectedSeccion]);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-64 bg-gray-100 rounded-xl">
      <p className="text-gray-400 text-sm">Cargando mapa...</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-gray-200">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '460px' }}
        center={DEFAULT_CENTER}
        zoom={11}
        onLoad={onLoad}
        options={MAP_OPTIONS}
      >
        {secciones.map((sec, index) => {
          const paths = parseWKT(sec.geometry);
          if (!paths.length) return null;
          const color = sectorColorMap[sec.pologono] || SECTOR_COLORS[0];
          const isSelected = selectedSeccion != null && selectedSeccion === sec.seccion;

          return (
            <React.Fragment key={sec.id ?? index}>
              {paths.map((ring, ri) => (
                <Polygon
                  key={`${sec.id}-${ri}`}
                  paths={ring}
                  onClick={() => {
                    setActiveInfo(sec);
                    onSelectSeccion?.(sec);
                  }}
                  options={{
                    fillColor: isSelected ? '#FBBF24' : color.fill,
                    strokeColor: isSelected ? '#92400E' : color.stroke,
                    fillOpacity: isSelected ? 0.75 : 0.4,
                    strokeWeight: isSelected ? 3 : 1.5,
                    zIndex: isSelected ? 10 : 1,
                  }}
                />
              ))}

              {activeInfo?.seccion === sec.seccion && (
                <InfoWindow
                  position={getCenter(paths)}
                  onCloseClick={() => setActiveInfo(null)}
                >
                  <div className="min-w-[200px] font-sans">
                    <p className="font-bold text-gray-800 text-sm mb-1">
                      Sección {sec.seccion}
                    </p>
                    <p className="text-xs text-gray-500">Distrito: <span className="font-medium text-gray-700">{sec.distrito_federal}</span></p>
                    <p className="text-xs text-gray-500">Sector: <span className="font-medium text-gray-700">{sec.pologono}</span></p>
                    {sec.lista_nominal != null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Lista nominal:{' '}
                        <span className="font-semibold text-blue-700">
                          {Number(sec.lista_nominal).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>

      {/* Leyenda de sectores */}
      {Object.keys(sectorColorMap).length > 0 && (
        <div className="bg-white px-4 py-2 flex flex-wrap gap-3 border-t border-gray-100">
          {Object.entries(sectorColorMap).map(([sector, color]) => (
            <div key={sector} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: color.fill, border: `1px solid ${color.stroke}` }}
              />
              <span className="text-xs text-gray-600">Sector {sector}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapTerritorial;
