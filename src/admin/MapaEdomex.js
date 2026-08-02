import React, { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, InfoWindow } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';

const GOOGLE_MAPS_KEY = 'AIzaSyCq9lepK0chTwx6vDjQlCftmP-IpCSBuPM';

const EDOMEX_CENTER = { lat: 19.35, lng: -99.65 };

const COLOR_PALETTE = [
  { fill: '#FF6B6B', stroke: '#C53B3B' },
  { fill: '#4ECDC4', stroke: '#2A9D8F' },
  { fill: '#FFD166', stroke: '#F4A261' },
  { fill: '#6A0572', stroke: '#4A0366' },
  { fill: '#118AB2', stroke: '#0A5A78' },
  { fill: '#06D6A0', stroke: '#04A77D' },
  { fill: '#7209B7', stroke: '#560BAD' },
  { fill: '#F15BB5', stroke: '#DE0D92' },
  { fill: '#3A86FF', stroke: '#2667CC' },
  { fill: '#FB5607', stroke: '#D34506' },
];

const parseMultipolygon = (wkt) => {
  try {
    wkt = String(wkt);
    const coordinatesString = wkt
      .replace('MULTIPOLYGON(((', '')
      .replace(')))', '');
    const polygons = coordinatesString.split('),(');
    const resultado = [];
    polygons.forEach(polygon => {
      const points = polygon.split(',').map(coord => {
        const [longitude, latitude] = coord.trim().split(' ').map(Number);
        return { lat: latitude, lng: longitude };
      });
      resultado.push(...points);
    });
    resultado.shift();
    return resultado;
  } catch {
    return [];
  }
};

const getPolygonCenter = (paths) => {
  if (!paths || paths.length === 0) return EDOMEX_CENTER;
  const latSum = paths.reduce((s, p) => s + p.lat, 0);
  const lngSum = paths.reduce((s, p) => s + p.lng, 0);
  return { lat: latSum / paths.length, lng: lngSum / paths.length };
};

const MapaEdomex = () => {
  const navigate = useNavigate();
  const [vista, setVista] = useState('distritos'); // 'distritos' | 'secciones'
  const [poligonos, setPoligonos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroDistrito, setFiltroDistrito] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  const fetchPoligonos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPoligonos([]);
    try {
      const tabla = vista === 'distritos' ? 'distritos_edomex' : 'secciones_edomex';
      let query = supabase.from(tabla).select('*');
      if (vista === 'secciones' && filtroDistrito) {
        query = query.eq('distrito', parseInt(filtroDistrito));
      }
      const { data, error: err } = await query.limit(500);
      if (err) throw err;
      setPoligonos(data || []);
    } catch (e) {
      setError(`Tabla pendiente: sube los polígonos a Supabase (${e.message})`);
    } finally {
      setLoading(false);
    }
  }, [vista, filtroDistrito]);

  useEffect(() => {
    fetchPoligonos();
  }, [fetchPoligonos]);

  const selectedItem = poligonos.find(p => p.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-white text-sm hover:underline"
        >
          ← Regresar
        </button>
        <h1 className="text-white font-bold text-lg">Mapa Estado de México</h1>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Controles */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Toggle vista */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Vista</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setVista('distritos'); setSelectedId(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    vista === 'distritos'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Distritos
                </button>
                <button
                  onClick={() => { setVista('secciones'); setSelectedId(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    vista === 'secciones'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Secciones
                </button>
              </div>
            </div>

            {/* Filtro distrito (solo en vista secciones) */}
            {vista === 'secciones' && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Distrito</p>
                <input
                  type="number"
                  value={filtroDistrito}
                  onChange={e => setFiltroDistrito(e.target.value)}
                  placeholder="Ej: 1"
                  className="border rounded-lg px-3 py-2 text-sm w-28"
                  min="1"
                  max="45"
                />
              </div>
            )}

            <button
              onClick={fetchPoligonos}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-all"
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          {/* Estadísticas */}
          {poligonos.length > 0 && (
            <div className="mt-3 flex gap-4 text-sm text-slate-500">
              <span><b className="text-slate-700">{poligonos.length}</b> {vista === 'distritos' ? 'distritos' : 'secciones'} cargadas</span>
              {selectedItem && (
                <span className="text-blue-600">
                  Seleccionado: {vista === 'distritos'
                    ? `Distrito ${selectedItem.distrito || selectedItem.id}`
                    : `Sección ${selectedItem.seccion || selectedItem.id}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Estado de error / pendiente */}
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⏳ Base de datos pendiente</p>
            <p>{error}</p>
            <p className="mt-2 text-xs text-amber-600">
              Una vez que subas los polígonos a Supabase, el mapa cargará automáticamente.
              <br />Tablas esperadas: <code>distritos_edomex</code> (con columna <code>geometry</code>) y <code>secciones_edomex</code> (con columnas <code>geometry</code>, <code>distrito</code>, <code>seccion</code>).
            </p>
          </div>
        )}

        {/* Mapa */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '520px' }}
              center={EDOMEX_CENTER}
              zoom={8}
              options={{
                mapTypeId: 'roadmap',
                styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
              }}
            >
              {poligonos.map((item, index) => {
                const paths = parseMultipolygon(item.geometry);
                if (!paths.length) return null;
                const isSelected = selectedId === item.id;
                const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
                return (
                  <React.Fragment key={item.id}>
                    <Polygon
                      paths={paths}
                      onClick={() => setSelectedId(isSelected ? null : item.id)}
                      options={{
                        fillColor: isSelected ? '#FFFF00' : color.fill,
                        strokeColor: isSelected ? '#CC9900' : color.stroke,
                        strokeWeight: isSelected ? 3 : 1.5,
                        fillOpacity: isSelected ? 0.7 : 0.45,
                      }}
                    />
                    {isSelected && (
                      <InfoWindow
                        position={getPolygonCenter(paths)}
                        onCloseClick={() => setSelectedId(null)}
                      >
                        <div className="text-sm">
                          {vista === 'distritos' ? (
                            <>
                              <p className="font-bold">Distrito {item.distrito ?? item.id}</p>
                              {item.nombre && <p>{item.nombre}</p>}
                              {item.municipio && <p className="text-gray-500">{item.municipio}</p>}
                            </>
                          ) : (
                            <>
                              <p className="font-bold">Sección {item.seccion ?? item.id}</p>
                              {item.distrito && <p>Distrito: {item.distrito}</p>}
                              {item.lista_nominal && <p>Lista nominal: {item.lista_nominal?.toLocaleString()}</p>}
                              {item.poligono && <p>Polígono: {item.poligono}</p>}
                            </>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </React.Fragment>
                );
              })}
            </GoogleMap>
          ) : (
            <div className="flex items-center justify-center" style={{ height: '520px' }}>
              <p className="text-slate-500">Cargando mapa...</p>
            </div>
          )}
        </div>

        {/* Leyenda */}
        {poligonos.length > 0 && (
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
              {vista === 'distritos' ? 'Distritos' : 'Secciones'}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {poligonos.slice(0, 10).map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className="flex items-center gap-2 text-xs hover:bg-slate-50 rounded px-1 py-0.5"
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{
                      backgroundColor: COLOR_PALETTE[index % COLOR_PALETTE.length].fill,
                      border: `1px solid ${COLOR_PALETTE[index % COLOR_PALETTE.length].stroke}`,
                    }}
                  />
                  <span className="truncate text-slate-600">
                    {vista === 'distritos'
                      ? `D${item.distrito ?? index + 1}`
                      : `Sec ${item.seccion ?? item.id}`}
                  </span>
                </button>
              ))}
              {poligonos.length > 10 && (
                <span className="text-xs text-slate-400 self-center">+{poligonos.length - 10} más</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapaEdomex;
