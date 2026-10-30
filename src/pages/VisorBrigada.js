import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import { GoogleMap, useJsApiLoader, Polygon, OverlayView, getMapRuntime } from '../map/territorialMapProvider';
import supabase from '../supabase/client';

const MAP_CONTAINER = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 19.70, lng: -98.97 };
const TRAIL_SAVE_INTERVAL = 30_000; // guarda el rastro cada 30 segundos
const MIN_DIST_METERS = 8;          // distancia mínima para agregar nuevo punto al rastro

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

// Distancia en metros entre dos puntos {lat, lng}
const distMeters = (a, b) => {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Punto pulsante para la ubicación actual
const PulsingDot = ({ color }) => (
  <div style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none', position: 'relative', width: 24, height: 24 }}>
    <style>{`
      @keyframes vb-pulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        70%  { transform: scale(2.8); opacity: 0; }
        100% { transform: scale(2.8); opacity: 0; }
      }
      .vb-pulse-ring {
        position: absolute; inset: 0; border-radius: 50%;
        animation: vb-pulse 1.8s ease-out infinite;
      }
      .vb-pulse-dot {
        position: absolute; inset: 4px; border-radius: 50%;
        border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,.5);
      }
    `}</style>
    <div className="vb-pulse-ring" style={{ backgroundColor: color }} />
    <div className="vb-pulse-dot" style={{ backgroundColor: color }} />
  </div>
);

const VisorBrigada = () => {
  const { slug } = useParams();

  const [brigada, setBrigada]         = useState(null);
  const [seccionesGeo, setSecGeo]     = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const [panelOpen, setPanelOpen]     = useState(false);
  const [secActiva, setSecActiva]     = useState(null);

  // Ubicación y rastro
  const [coords, setCoords]           = useState(null);   // {lat, lng}
  const [trail, setTrail]             = useState([]);      // [{lat,lng}, ...]
  const [tracking, setTracking]       = useState(false);
  const [geoError, setGeoError]       = useState('');
  const [recorridoId, setRecorridoId] = useState(null);

  // Refs para el rastro Leaflet (dibujado imperativamente)
  const polylineRef   = useRef(null);
  const watchIdRef    = useRef(null);
  const trailRef      = useRef([]);          // copia sincrónica para el save timer
  const lastSavedRef  = useRef(0);

  const { isLoaded } = useJsApiLoader({});

  // ── Carga de datos ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const { data: brig } = await supabase
        .from('brigadas').select('*').eq('slug', slug).single();
      if (!brig) { setCargando(false); return; }
      setBrigada(brig);

      if ((brig.secciones ?? []).length > 0) {
        const { data: geos } = await supabase
          .from('secciones').select('seccion, geometry').in('seccion', brig.secciones);
        setSecGeo(geos ?? []);
      }
      setCargando(false);
    };
    fetchData();
  }, [slug]);

  // ── Carga del mapa ────────────────────────────────────────────────────────
  const onMapLoad = useCallback((facade) => setMapInstance(facade), []);

  useEffect(() => {
    if (!mapInstance || !isLoaded || seccionesGeo.length === 0) return;
    const runtime = getMapRuntime();
    if (!runtime) return;
    const bounds = new (runtime.maps.LatLngBounds)();
    seccionesGeo.forEach(sec => parseWKT(sec.geometry).flat().forEach(p => bounds.extend(p)));
    mapInstance.fitBounds(bounds, 48);
  }, [mapInstance, seccionesGeo, isLoaded]);

  // ── Rastro: dibuja / actualiza la polilínea en Leaflet ────────────────────
  useEffect(() => {
    if (!mapInstance?._leaflet || trail.length < 2) return;
    const leafletMap = mapInstance._leaflet;
    const latlngs = trail.map(p => [p.lat, p.lng]);
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latlngs);
    } else {
      polylineRef.current = L.polyline(latlngs, {
        color: brigada?.color ?? '#3B82F6',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(leafletMap);
    }
  }, [trail, mapInstance, brigada?.color]);

  // Limpia la polilínea al desmontar
  useEffect(() => () => { polylineRef.current?.remove(); polylineRef.current = null; }, []);

  // ── Guardado periódico del rastro en Supabase ─────────────────────────────
  const saveTrail = useCallback(async (currentTrail, id) => {
    if (!id || currentTrail.length === 0) return;
    await supabase.from('brigada_recorridos')
      .update({ trail: currentTrail, updated_at: new Date().toISOString() })
      .eq('id', id);
    lastSavedRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!recorridoId) return;
    const timer = setInterval(() => saveTrail(trailRef.current, recorridoId), TRAIL_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [recorridoId, saveTrail]);

  // Guarda al cerrar / cambiar de pestaña
  useEffect(() => {
    const handler = () => saveTrail(trailRef.current, recorridoId);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [recorridoId, saveTrail]);

  // ── Iniciar seguimiento ───────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setGeoError('');

    // Crea registro en BD para esta sesión
    const { data: rec } = await supabase.from('brigada_recorridos').insert({
      brigada_id: brigada?.id ?? null,
      slug,
      trail: [],
    }).select('id').single();
    if (rec) setRecorridoId(rec.id);

    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(punto);

        // Solo agrega si se movió suficiente
        setTrail(prev => {
          const last = prev[prev.length - 1];
          if (last && distMeters(last, punto) < MIN_DIST_METERS) return prev;
          const next = [...prev, punto];
          trailRef.current = next;
          return next;
        });
      },
      (err) => {
        setGeoError(
          err.code === 1 ? 'Permiso de ubicación denegado.' :
          err.code === 2 ? 'No se pudo obtener la ubicación.' :
          'Error al obtener ubicación.'
        );
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [brigada?.id, slug]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    saveTrail(trailRef.current, recorridoId);
    setTracking(false);
  }, [recorridoId, saveTrail]);

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  // Centra en la ubicación cuando llega el primer punto
  useEffect(() => {
    if (!coords || !mapInstance) return;
    mapInstance.panTo(coords);
  // solo al primer punto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat !== undefined && !trail.length ? coords : null, mapInstance]);

  // ── Render ────────────────────────────────────────────────────────────────
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
        <div className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white/20" style={{ backgroundColor: brigColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate">{brigada.nombre}</p>
          <p className="text-slate-400 text-[11px]">
            Sector {brigada.sector} · {seccionesOrdenadas.length} secciones
            {trail.length > 1 && (
              <span className="ml-2 text-emerald-400 font-semibold">· {trail.length} pts recorridos</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            panelOpen ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          Lista
        </button>
      </div>

      {/* Panel secciones */}
      {panelOpen && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800" style={{ backgroundColor: '#1E293B' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Secciones asignadas</p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {seccionesOrdenadas.map(s => (
              <span
                key={s}
                className="text-xs font-bold px-2 py-0.5 rounded text-white cursor-pointer hover:opacity-80"
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
          <p className="text-[9px] text-slate-600 mt-1.5">Toca una sección para centrar el mapa</p>
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
            {/* Polígonos de secciones */}
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
                      fillOpacity: secActiva === sec.seccion ? 0.55 : 0.25,
                      clickable: true,
                    }}
                    onClick={() => setSecActiva(s => s === sec.seccion ? null : sec.seccion)}
                  />
                ))}
                {sec.centroid && (
                  <OverlayView position={sec.centroid} mapPaneName="overlayLayer">
                    <div style={{
                      transform: 'translate(-50%,-50%)', pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.65)', color: '#fff',
                      borderRadius: 4, padding: '2px 6px',
                      fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                    }}>
                      {sec.seccion}
                    </div>
                  </OverlayView>
                )}
              </React.Fragment>
            ))}

            {/* Marcador de posición actual */}
            {coords && (
              <OverlayView position={coords} mapPaneName="overlayLayer">
                <PulsingDot color={tracking ? '#22C55E' : '#94A3B8'} />
              </OverlayView>
            )}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-900">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Etiqueta de sección activa */}
        {secActiva !== null && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg pointer-events-none">
            Sección {secActiva}
          </div>
        )}
      </div>

      {/* Barra de seguimiento */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-800 flex items-center gap-3" style={{ backgroundColor: '#0F172A' }}>
        {geoError && (
          <p className="text-xs text-red-400 flex-1">{geoError}</p>
        )}
        {!geoError && (
          <div className="flex-1 min-w-0">
            {!tracking && !coords && (
              <p className="text-xs text-slate-400">Activa tu ubicación para registrar el recorrido</p>
            )}
            {tracking && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block animate-pulse" />
                Registrando recorrido…
              </p>
            )}
            {!tracking && coords && (
              <p className="text-xs text-slate-400">Recorrido guardado · {trail.length} puntos</p>
            )}
          </div>
        )}
        {!tracking ? (
          <button
            onClick={startTracking}
            className="flex-shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Iniciar recorrido
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="flex-shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <span className="w-3 h-3 bg-white rounded-sm inline-block" />
            Detener
          </button>
        )}
      </div>
    </div>
  );
};

export default VisorBrigada;
