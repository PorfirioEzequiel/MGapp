import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Polygon, OverlayView, getMapRuntime } from '../map/territorialMapProvider';
import supabase from '../supabase/client';

const MAP_CONTAINER = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 19.70, lng: -98.97 };

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

const getCentroid = (pathGroups) => {
  const all = pathGroups.flat();
  if (!all.length) return null;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
};

const VisorBrigada = () => {
  const { slug } = useParams();

  const [brigada, setBrigada]         = useState(null);
  const [seccionesGeo, setSecGeo]     = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [secActiva, setSecActiva]     = useState(null);

  const { isLoaded } = useJsApiLoader({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: brig } = await supabase
        .from('brigadas')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!brig) { setCargando(false); return; }
      setBrigada(brig);

      if ((brig.secciones ?? []).length > 0) {
        const { data: geos } = await supabase
          .from('secciones')
          .select('seccion, geometry')
          .in('seccion', brig.secciones);
        setSecGeo(geos ?? []);
      }
      setCargando(false);
    };
    fetchData();
  }, [slug]);

  const onMapLoad = useCallback((facade) => setMapInstance(facade), []);

  // Auto-fit bounds cuando el mapa y las geometrías estén listos
  useEffect(() => {
    if (!mapInstance || !isLoaded || seccionesGeo.length === 0) return;
    const runtime = getMapRuntime();
    if (!runtime) return;
    const bounds = new (runtime.maps.LatLngBounds)();
    seccionesGeo.forEach(sec => {
      parseWKT(sec.geometry).flat().forEach(p => bounds.extend(p));
    });
    mapInstance.fitBounds(bounds, 48);
  }, [mapInstance, seccionesGeo, isLoaded]);

  if (cargando) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!brigada) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-5xl mb-4">🗺️</p>
        <p className="text-white font-bold text-lg">Brigada no encontrada</p>
        <p className="text-slate-400 text-sm mt-1">El enlace puede ser incorrecto.</p>
      </div>
    </div>
  );

  const brigColor = brigada.color ?? '#3B82F6';

  const parsed = seccionesGeo.map(sec => {
    const paths = parseWKT(sec.geometry);
    return { seccion: sec.seccion, paths, centroid: getCentroid(paths) };
  }).filter(s => s.paths.length > 0);

  const seccionesOrdenadas = [...(brigada.secciones ?? [])].sort((a, b) => a - b);

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#0F172A' }}>
        <div
          className="w-4 h-4 rounded-full flex-shrink-0 shadow-lg ring-2 ring-white/20"
          style={{ backgroundColor: brigColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate">{brigada.nombre}</p>
          <p className="text-slate-400 text-[11px]">
            Sector {brigada.sector} · {seccionesOrdenadas.length} secciones asignadas
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            panelOpen
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          Lista
        </button>
      </div>

      {/* Panel de secciones */}
      {panelOpen && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800" style={{ backgroundColor: '#1E293B' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Secciones asignadas a este equipo
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {seccionesOrdenadas.map(s => (
              <span
                key={s}
                className="text-xs font-bold px-2 py-0.5 rounded text-white cursor-pointer transition-opacity hover:opacity-80"
                style={{ backgroundColor: brigColor }}
                onClick={() => {
                  const geo = parsed.find(p => p.seccion === s);
                  if (geo?.centroid && mapInstance) {
                    mapInstance.panTo(geo.centroid);
                    mapInstance.setZoom(15);
                    setSecActiva(s);
                    setPanelOpen(false);
                  }
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 mt-2">Toca una sección para centrar el mapa</p>
        </div>
      )}

      {/* Mapa */}
      <div className="flex-1 relative min-h-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={DEFAULT_CENTER}
            zoom={12}
            baseStyle="satelite"
            onLoad={onMapLoad}
            options={{ gestureHandling: 'greedy' }}
          >
            {parsed.map(sec => (
              <React.Fragment key={sec.seccion}>
                {sec.paths.map((path, i) => (
                  <Polygon
                    key={`${sec.seccion}-${i}`}
                    paths={path}
                    options={{
                      strokeColor: brigColor,
                      strokeWeight: secActiva === sec.seccion ? 3 : 1.5,
                      fillColor: brigColor,
                      fillOpacity: secActiva === sec.seccion ? 0.6 : 0.35,
                      clickable: true,
                    }}
                    onClick={() => setSecActiva(s => s === sec.seccion ? null : sec.seccion)}
                  />
                ))}
                {sec.centroid && (
                  <OverlayView
                    position={sec.centroid}
                    mapPaneName="overlayLayer"
                  >
                    <div
                      style={{
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0,0,0,0.72)',
                        color: 'white',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      {sec.seccion}
                    </div>
                  </OverlayView>
                )}
              </React.Fragment>
            ))}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-900">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {secActiva !== null && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg pointer-events-none">
            Sección {secActiva}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisorBrigada;
