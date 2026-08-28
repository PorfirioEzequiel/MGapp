import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Polygon, Polyline } from "@react-google-maps/api";
import { supabaseStorage as supabaseAdmin } from "../supabase/client";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "../utils/googleMapsConfig";

const TECAMAC_CENTER = { lat: 19.71, lng: -98.97 };
const MAP_CONTAINER = { width: "100%", height: "100%" };

// ── Geometry helpers ──────────────────────────────────────────────────────────
const parseWKT = (wkt) => {
  if (!wkt) return [];
  const s = String(wkt).trim();
  const toPoints = (str) =>
    str.trim().split(",").map((coord) => {
      const p = coord.trim().split(/\s+/);
      return { lat: Number(p[1]), lng: Number(p[0]) };
    }).filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

  const groups = [];
  const rx = /\(\(([^()]+)\)\)/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const pts = toPoints(m[1]);
    if (pts.length) groups.push(pts);
  }
  if (groups.length) return groups;

  const inner = s
    .replace(/MULTIPOLYGON\s*\(\(\(/, "").replace(/\)\)\)$/, "")
    .replace(/POLYGON\s*\(\(/, "").replace(/\)\)$/, "");
  const fb = toPoints(inner);
  return fb.length ? [fb] : [];
};

const pathsToWKT = (paths) => {
  const rings = paths.map((ring) => {
    const pts = [...ring];
    if (pts.length && (pts[0].lat !== pts[pts.length - 1].lat || pts[0].lng !== pts[pts.length - 1].lng)) {
      pts.push(pts[0]);
    }
    return pts.map((p) => `${p.lng} ${p.lat}`).join(", ");
  });
  if (rings.length === 1) return `POLYGON((${rings[0]}))`;
  return `MULTIPOLYGON(${rings.map((r) => `((${r}))`).join(", ")})`;
};

const readPathsFromGooglePolygon = (googlePoly) => {
  const paths = [];
  googlePoly.getPaths().forEach((path) => {
    const ring = [];
    path.forEach((ll) => ring.push({ lat: ll.lat(), lng: ll.lng() }));
    paths.push(ring);
  });
  return paths;
};

const getCenter = (paths) => {
  const all = paths.flat();
  if (!all.length) return TECAMAC_CENTER;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length,
  };
};

// ── Modal editor de polígono ──────────────────────────────────────────────────
//
// Dibujo manual con clics en el mapa (reemplaza DrawingManager, deprecado en v3.65).
// Para polígono existente: <Polygon editable> con referencia nativa leída al guardar.
//
const MapaEditorModal = ({ existingPaths: existingPathsProp, seccionPaths, onSave, onCancel }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // initPaths capturado una sola vez para no reinicializar el Polygon al re-render
  const [initPaths] = useState(() => existingPathsProp ?? []);

  // Ref al objeto Google Maps nativo (existente o nuevo)
  const polygonRef = useRef(null);

  // Estado del editor
  const [showExisting, setShowExisting] = useState(initPaths.length > 0);
  const [drawingPoints, setDrawingPoints] = useState([]);   // puntos en progreso
  const [completedPoly, setCompletedPoly] = useState(null); // ring final dibujado

  const isDrawingActive = !showExisting && completedPoly === null;
  const hasCompletedPoly = completedPoly !== null;
  const canSave = showExisting || hasCompletedPoly;

  const referencePaths = initPaths.length ? initPaths : (seccionPaths ?? []);
  const initialCenter = referencePaths.length ? getCenter(referencePaths) : TECAMAC_CENTER;
  const initialZoom = referencePaths.length ? 15 : 13;

  // Clic en el mapa → agrega punto al polígono en progreso
  const onMapClick = useCallback((e) => {
    if (!e.latLng) return;
    setDrawingPoints((prev) => [...prev, { lat: e.latLng.lat(), lng: e.latLng.lng() }]);
  }, []);

  // Cierra el polígono con los puntos actuales
  const cerrarPoligono = () => {
    if (drawingPoints.length >= 3) {
      setCompletedPoly([...drawingPoints]);
      setDrawingPoints([]);
    }
  };

  const deshacerUltimoPunto = () => setDrawingPoints((prev) => prev.slice(0, -1));

  // Guarda ref al Polygon existente
  const onExistingLoad = useCallback((poly) => { polygonRef.current = poly; }, []);
  // Guarda ref al Polygon nuevo (ya cerrado, editable)
  const onNewLoad = useCallback((poly) => { polygonRef.current = poly; }, []);

  const handleReset = () => {
    polygonRef.current = null;
    setShowExisting(false);
    setCompletedPoly(null);
    setDrawingPoints([]);
  };

  const handleSave = () => {
    let paths;
    if (showExisting) {
      if (!polygonRef.current) { alert("No se encontró el polígono."); return; }
      paths = readPathsFromGooglePolygon(polygonRef.current);
    } else if (hasCompletedPoly) {
      // Intentar leer ediciones del objeto nativo; si no, usar los puntos originales
      if (polygonRef.current) {
        paths = readPathsFromGooglePolygon(polygonRef.current);
      } else {
        paths = [completedPoly];
      }
    } else {
      alert("Dibuja un polígono primero.");
      return;
    }
    if (!paths.length || paths[0].length < 3) {
      alert("El polígono debe tener al menos 3 puntos.");
      return;
    }
    onSave(pathsToWKT(paths));
  };

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <p className="text-slate-500 text-sm">Cargando mapa...</p>
      </div>
    );
  }

  // Línea de cierre visual (último punto → primer punto)
  const closingLine = drawingPoints.length >= 3
    ? [drawingPoints[drawingPoints.length - 1], drawingPoints[0]]
    : null;

  return (
    <>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER}
        center={initialCenter}
        zoom={initialZoom}
        options={{
          mapTypeId: "hybrid",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          disableDoubleClickZoom: isDrawingActive,
          draggableCursor: isDrawingActive ? "crosshair" : undefined,
        }}
        onClick={isDrawingActive ? onMapClick : undefined}
      >
        {/* Sección de referencia — estática */}
        {seccionPaths?.length > 0 && (
          <Polygon
            paths={seccionPaths}
            options={{
              fillColor: "#FFFFFF", fillOpacity: 0.08,
              strokeColor: "#FACC15", strokeWeight: 2.5, strokeOpacity: 0.9,
              clickable: false, zIndex: 1,
            }}
          />
        )}

        {/* Polígono existente — editable. No escuchamos onMouseUp para evitar
            re-renders que resetearían los vértices; leemos el objeto nativo al guardar. */}
        {showExisting && initPaths.length > 0 && (
          <Polygon
            paths={initPaths}
            editable
            draggable
            onLoad={onExistingLoad}
            options={{
              fillColor: "#3B82F6", fillOpacity: 0.35,
              strokeColor: "#1D4ED8", strokeWeight: 2, zIndex: 2,
            }}
          />
        )}

        {/* Polígono en progreso: línea continua entre los puntos trazados */}
        {isDrawingActive && drawingPoints.length > 1 && (
          <Polyline
            path={drawingPoints}
            options={{ strokeColor: "#3B82F6", strokeWeight: 2.5, zIndex: 3 }}
          />
        )}
        {/* Línea de cierre (último → primero) para previsualizar el polígono */}
        {isDrawingActive && closingLine && (
          <Polyline
            path={closingLine}
            options={{ strokeColor: "#3B82F6", strokeWeight: 1.5, strokeOpacity: 0.45, zIndex: 3 }}
          />
        )}

        {/* Polígono nuevo ya cerrado — editable para ajustar vértices */}
        {hasCompletedPoly && (
          <Polygon
            paths={[completedPoly]}
            editable
            draggable
            onLoad={onNewLoad}
            options={{
              fillColor: "#3B82F6", fillOpacity: 0.35,
              strokeColor: "#1D4ED8", strokeWeight: 2, zIndex: 2,
            }}
          />
        )}
      </GoogleMap>

      {/* Toolbar de dibujo */}
      {isDrawingActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/75 text-white text-xs rounded-full px-4 py-2 whitespace-nowrap">
          {drawingPoints.length === 0
            ? <span>Clic en el mapa para trazar puntos</span>
            : <span className="font-semibold">{drawingPoints.length} puntos</span>
          }
          {drawingPoints.length > 0 && (
            <button
              onClick={deshacerUltimoPunto}
              className="opacity-75 hover:opacity-100 underline"
            >
              Deshacer
            </button>
          )}
          {drawingPoints.length >= 3 && (
            <button
              onClick={cerrarPoligono}
              className="bg-blue-600 hover:bg-blue-500 font-semibold px-3 py-0.5 rounded-full"
            >
              Cerrar polígono
            </button>
          )}
        </div>
      )}

      {/* Confirmación de polígono completado */}
      {hasCompletedPoly && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs rounded-full px-4 py-2 pointer-events-none">
          Arrastra los vértices para ajustar · luego guarda
        </div>
      )}

      {/* Leyenda */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs rounded-lg px-3 py-2 space-y-1 pointer-events-none">
        {seccionPaths?.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-5 border-t-2 border-yellow-400 block" />
            <span>Límite sección</span>
          </div>
        )}
        {canSave && (
          <div className="flex items-center gap-2">
            <span className="w-5 border-t-2 border-blue-400 block" />
            <span>Fracción</span>
          </div>
        )}
      </div>

      {/* Barra inferior */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-2">
        {canSave && (
          <button
            onClick={handleReset}
            className="text-sm text-red-500 hover:text-red-700 border border-red-300 px-3 py-1.5 rounded-lg transition-all"
          >
            Redibujar
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onCancel} className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 transition-all"
        >
          Guardar polígono
        </button>
      </div>
    </>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const EditorFracciones = () => {
  const navigate = useNavigate();
  const [sectores, setSectores] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [fracciones, setFracciones] = useState([]);
  const [seccionGeo, setSeccionGeo] = useState(null);

  const [sectorSel, setSectorSel] = useState(null);
  const [seccionSel, setSeccionSel] = useState(null);

  const [fraccionInput, setFraccionInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);
  const [pendingGeometry, setPendingGeometry] = useState(null);

  // ── Carga sectores ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabaseAdmin.from("ubt_catalogo").select("sector").order("sector")
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setSectores([...new Set(data.map((r) => r.sector))]);
      });
  }, []);

  // ── Carga secciones ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sectorSel) { setSecciones([]); setSeccionSel(null); return; }
    supabaseAdmin.from("ubt_catalogo").select("seccion").eq("sector", sectorSel).order("seccion")
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        setSecciones([...new Set(data.map((r) => r.seccion))]);
        setSeccionSel(null);
        setFracciones([]);
        setSeccionGeo(null);
      });
  }, [sectorSel]);

  // ── Carga sección + fracciones ──────────────────────────────────────────────
  const cargarSeccionYFracciones = useCallback(async () => {
    if (!sectorSel || !seccionSel) return;
    setLoading(true);
    setError(null);

    const [secRes, fracRes] = await Promise.all([
      supabaseAdmin.from("secciones").select("geometry").eq("seccion", seccionSel).maybeSingle(),
      supabaseAdmin.from("fracciones").select("fraccion, geometry")
        .eq("sector", sectorSel).eq("seccion", seccionSel).order("fraccion"),
    ]);

    if (secRes.error) setError(secRes.error.message);
    else setSeccionGeo(secRes.data?.geometry ?? null);

    if (fracRes.error) setError(fracRes.error.message);
    else setFracciones(fracRes.data ?? []);

    setLoading(false);
  }, [sectorSel, seccionSel]);

  useEffect(() => {
    cargarSeccionYFracciones();
    setPendingGeometry(null);
    setFraccionInput("");
  }, [cargarSeccionYFracciones]);

  // ── Validaciones del input ──────────────────────────────────────────────────
  const fraccionNum = parseInt(fraccionInput, 10);
  const fraccionValida = fraccionInput !== "" && !isNaN(fraccionNum) && fraccionNum > 0;
  const fraccionLabel = fraccionValida && seccionSel
    ? `F${seccionSel}-${String(fraccionNum).padStart(2, "0")}`
    : "";
  const fraccionDuplicada = fraccionValida && fracciones.some((f) => f.fraccion === fraccionLabel);

  // ── Agregar fracción ────────────────────────────────────────────────────────
  const agregarFraccion = async () => {
    if (!fraccionValida) { alert("Ingresa un número válido para la fracción."); return; }
    if (fraccionDuplicada) { alert(`La fracción ${fraccionLabel} ya existe en la sección ${seccionSel}.`); return; }

    setGuardando(true);
    setError(null);
    try {
      const { data: meta, error: eMeta } = await supabaseAdmin
        .from("ubt_catalogo")
        .select("dtto_fed, dtto_loc, municipio, nombre_municipio")
        .eq("sector", sectorSel).eq("seccion", seccionSel)
        .limit(1).single();
      if (eMeta) throw eMeta;

      const { error: e1 } = await supabaseAdmin.from("ubt_catalogo").insert([{
        dtto_fed: meta.dtto_fed,
        dtto_loc: meta.dtto_loc,
        municipio: meta.municipio,
        nombre_municipio: meta.nombre_municipio,
        sector: sectorSel,
        seccion: seccionSel,
        fraccion: fraccionLabel,
      }]);
      if (e1) throw e1;

      const { error: e2 } = await supabaseAdmin.from("fracciones").insert([{
        sector: sectorSel,
        seccion: seccionSel,
        fraccion: fraccionLabel,
        geometry: pendingGeometry ?? null,
      }]);
      if (e2) throw e2;

      setFraccionInput("");
      setPendingGeometry(null);
      cargarSeccionYFracciones();
    } catch (err) {
      setError("Error al agregar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Guardar geometría de fracción existente ─────────────────────────────────
  const guardarGeometria = async (fraccionId, wkt) => {
    setGuardando(true);
    setError(null);
    try {
      const { error: e } = await supabaseAdmin
        .from("fracciones").update({ geometry: wkt })
        .eq("sector", sectorSel).eq("seccion", seccionSel).eq("fraccion", fraccionId);
      if (e) throw e;
      setModal(null);
      cargarSeccionYFracciones();
    } catch (err) {
      setError("Error al guardar geometría: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar fracción ───────────────────────────────────────────────────────
  const eliminarFraccion = async (fraccion) => {
    if (!window.confirm(`¿Eliminar fracción ${fraccion} de la sección ${seccionSel}?\n\nEsta acción no se puede deshacer.`)) return;
    setGuardando(true);
    setError(null);
    try {
      const { error: e1 } = await supabaseAdmin.from("ubt_catalogo").delete()
        .eq("sector", sectorSel).eq("seccion", seccionSel).eq("fraccion", fraccion);
      if (e1) throw e1;
      const { error: e2 } = await supabaseAdmin.from("fracciones").delete()
        .eq("sector", sectorSel).eq("seccion", seccionSel).eq("fraccion", fraccion);
      if (e2) throw e2;
      cargarSeccionYFracciones();
    } catch (err) {
      setError("Error al eliminar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Modal handlers ──────────────────────────────────────────────────────────
  const handleSaveModal = (wkt) => {
    if (modal?.mode === "nueva") {
      setPendingGeometry(wkt);
      setModal(null);
    } else if (modal?.mode === "editar") {
      guardarGeometria(modal.fraccionId, wkt);
    }
  };

  const seccionPaths = seccionGeo ? parseWKT(seccionGeo) : [];
  const fraccionEditando = modal?.mode === "editar"
    ? fracciones.find((f) => f.fraccion === modal.fraccionId)
    : null;
  const existingPathsForModal = modal?.mode === "editar"
    ? (fraccionEditando?.geometry ? parseWKT(fraccionEditando.geometry) : [])
    : (pendingGeometry ? parseWKT(pendingGeometry) : []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white text-base transition-all duration-150 shrink-0"
          >
            ←
          </button>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Editor de Fracciones</h1>
            <p className="text-blue-200 text-xs mt-0.5">Gestión de límites geográficos</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ① Sector */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sector</p>
            {sectorSel && (
              <span className="ml-auto text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">{sectorSel}</span>
            )}
          </div>
          <div className="p-4">
            {sectores.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-pulse" />
                <p className="text-sm text-slate-400">Cargando sectores...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sectores.map((s) => (
                  <button key={s}
                    onClick={() => setSectorSel(s === sectorSel ? null : s)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-150 cursor-pointer ${
                      sectorSel === s
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ② Sección */}
        {sectorSel && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sección</p>
              {seccionSel && (
                <span className="ml-auto text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">{seccionSel}</span>
              )}
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {secciones.map((s) => (
                  <button key={s}
                    onClick={() => setSeccionSel(s === seccionSel ? null : s)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all duration-150 cursor-pointer ${
                      seccionSel === s
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ③ Fracciones */}
        {sectorSel && seccionSel && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Fracciones</p>
              <span className={`ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full ${
                fracciones.length > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"
              }`}>
                {fracciones.length} {fracciones.length === 1 ? "fracción" : "fracciones"}
              </span>
            </div>

            {loading ? (
              <div className="p-6 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                <p className="text-sm text-slate-400">Cargando fracciones...</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Lista */}
                {fracciones.length === 0 ? (
                  <div className="text-center py-8 select-none">
                    <p className="text-3xl mb-2 opacity-30">⬡</p>
                    <p className="text-sm font-semibold text-slate-500">Sin fracciones registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Agrega la primera fracción de la sección {seccionSel}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {fracciones.map((f) => {
                      const tieneGeo = Boolean(f.geometry);
                      return (
                        <div key={f.fraccion}
                          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all duration-150"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tieneGeo ? "bg-emerald-500" : "bg-amber-400"}`} />
                          <span className="text-sm font-bold text-slate-800 w-12 shrink-0">{f.fraccion}</span>
                          <span className={`text-xs font-medium hidden sm:block ${tieneGeo ? "text-emerald-600" : "text-amber-600"}`}>
                            {tieneGeo ? "Con polígono" : "Sin polígono"}
                          </span>
                          <div className="flex-1" />
                          <button
                            onClick={() => setModal({ mode: "editar", fraccionId: f.fraccion })}
                            disabled={guardando}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 disabled:opacity-40 cursor-pointer ${
                              tieneGeo
                                ? "border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                                : "border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-400"
                            }`}
                          >
                            {tieneGeo ? "Editar" : "Dibujar"}
                          </button>
                          <button
                            onClick={() => eliminarFraccion(f.fraccion)}
                            disabled={guardando}
                            title="Eliminar fracción"
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all duration-150 disabled:opacity-0 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Agregar nueva fracción */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Agregar fracción</p>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Número"
                      value={fraccionInput}
                      onChange={(e) => setFraccionInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && agregarFraccion()}
                      className={`border-2 rounded-xl px-3 py-2 text-sm w-36 font-mono focus:outline-none transition-all duration-150 ${
                        fraccionDuplicada
                          ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100"
                          : fraccionValida
                          ? "border-emerald-400 bg-emerald-50 focus:ring-2 focus:ring-emerald-100"
                          : "border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      }`}
                    />
                    {fraccionDuplicada && (
                      <span className="text-xs text-red-500 font-semibold">Ya existe</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {fraccionValida && !fraccionDuplicada && (
                      <button
                        onClick={() => setModal({ mode: "nueva" })}
                        className={`text-xs font-semibold px-3 py-2 rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                          pendingGeometry
                            ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                            : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        {pendingGeometry ? "✓ Polígono listo" : "Dibujar polígono"}
                      </button>
                    )}
                    <button
                      onClick={agregarFraccion}
                      disabled={guardando || !fraccionValida || fraccionDuplicada}
                      className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold px-5 py-2 rounded-xl disabled:opacity-40 transition-all duration-150 shadow-sm cursor-pointer"
                    >
                      {guardando ? "Guardando..." : "+ Agregar"}
                    </button>
                  </div>

                  {pendingGeometry && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <span>Polígono listo · se guardará al agregar</span>
                      <button
                        onClick={() => setPendingGeometry(null)}
                        className="text-red-400 hover:text-red-600 font-semibold ml-3 transition-colors cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de mapa */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 flex items-center gap-3 shadow-lg z-10">
            <button
              onClick={() => setModal(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all duration-150 shrink-0 cursor-pointer"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-none">
                {modal.mode === "nueva" ? "Dibujar polígono" : "Editar polígono"}
              </p>
              <p className="text-blue-200 text-xs mt-0.5 truncate">
                {modal.mode === "nueva"
                  ? `Nueva fracción${fraccionLabel ? ` · ${fraccionLabel}` : ""} — Sección ${seccionSel}`
                  : `Fracción ${modal.fraccionId} · Sección ${seccionSel}`}
              </p>
            </div>
          </div>
          <div className="flex-1 relative">
            <MapaEditorModal
              key={`${modal.mode}-${modal.fraccionId ?? "nueva"}`}
              existingPaths={existingPathsForModal}
              seccionPaths={seccionPaths}
              onSave={handleSaveModal}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorFracciones;
