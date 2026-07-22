import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabase/client";
import MapTerritorial from "../map/MapTerritorial";

// ── helpers ──────────────────────────────────────────────────────────────────

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
    {children}
  </div>
);

const inputCls =
  "border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full";
const selectCls =
  "border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full";

const SectionTitle = ({ children }) => (
  <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 border-b border-slate-100 pb-2 mb-4">
    {children}
  </h2>
);

// Garantiza que el valor actual siempre aparezca en las opciones
const ensureOption = (options, value) => {
  const sv = String(value ?? "");
  if (!sv || options.some(o => String(o) === sv)) return options;
  return [sv, ...options];
};

// ── foto card ────────────────────────────────────────────────────────────────

const PhotoCard = ({ url, alt, shape, onUpload, uploading }) => {
  // shape: 'portrait' | 'landscape'
  const containerCls =
    shape === "landscape"
      ? "w-full max-w-xs h-40"   // credencial INE: ~2.5:1
      : "w-40 h-52";             // foto perfil: ~0.77:1

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${containerCls} rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center`}>
        {url ? (
          <img
            src={url}
            alt={alt}
            className="w-full h-full object-cover"
            onError={e => {
              e.target.style.display = "none";
              e.target.parentNode.querySelector(".placeholder")?.style.removeProperty("display");
            }}
          />
        ) : null}
        <div
          className="placeholder flex flex-col items-center justify-center w-full h-full"
          style={{ display: url ? "none" : "flex" }}
        >
          <span className="text-3xl">📷</span>
          <span className="text-[10px] text-slate-400 mt-1 text-center px-2">Sin imagen</span>
        </div>
      </div>
      <label className="cursor-pointer">
        <span className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors block text-center">
          {uploading ? "Subiendo…" : "Cambiar foto"}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
      </label>
      <p className="text-[10px] text-slate-400 text-center">{alt}</p>
    </div>
  );
};

// ── componente principal ─────────────────────────────────────────────────────

const FichaCiudadano = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ciudadano, setCiudadano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});
  const [seccionGeo, setSeccionGeo] = useState(null);
  const [fracciones, setFracciones] = useState([]);
  const [catalogo, setCatalogo] = useState([]);

  let viewer = null;
  try { viewer = JSON.parse(sessionStorage.getItem("user")); } catch { viewer = null; }
  const viewerEsSM = viewer?.puesto?.toUpperCase() === "SM";

  // Cargar ciudadano
  useEffect(() => {
    supabase.from("ciudadania").select("*").eq("id", id).single().then(({ data, error }) => {
      if (!error) setCiudadano(data);
      setLoading(false);
    });
  }, [id]);

  // Cargar catálogo completo para los selects en cascada
  useEffect(() => {
    supabase
      .from("ubt_catalogo")
      .select("dtto_fed, dtto_loc, poligono, sector, seccion, fraccion")
      .then(({ data }) => {
        if (!data) return;
        // Normalizar: usar 'poligono' como campo principal del sector;
        // si está vacío en alguna fila, usar 'sector' como fallback.
        const norm = data.map(r => ({
          ...r,
          poligono: r.poligono != null && r.poligono !== "" ? String(r.poligono) : String(r.sector ?? ""),
          seccion: String(r.seccion ?? ""),
          fraccion: String(r.fraccion ?? ""),
          dtto_fed: String(r.dtto_fed ?? ""),
          dtto_loc: String(r.dtto_loc ?? ""),
        }));
        setCatalogo(norm);
      });
  }, []);

  // Geometría de la sección para el mapa
  useEffect(() => {
    if (!ciudadano?.seccion) { setSeccionGeo(null); setFracciones([]); return; }
    const num = Number(ciudadano.seccion);
    Promise.all([
      supabase.from("secciones").select("*").eq("seccion", num).maybeSingle(),
      supabase.from("fracciones").select("fraccion, seccion, geometry").eq("seccion", num),
    ]).then(([sec, frac]) => {
      setSeccionGeo(sec.data ?? null);
      setFracciones(frac.data ?? []);
    });
  }, [ciudadano?.seccion]);

  // ── opciones en cascada ─────────────────────────────────────────────────────
  const curDttoFed = String(ciudadano?.dtto_fed ?? "");
  const curDttoLoc = String(ciudadano?.dtto_loc ?? "");
  const curPoligono = String(ciudadano?.poligono ?? "");
  const curSeccion  = String(ciudadano?.seccion  ?? "");
  const curUbt      = String(ciudadano?.ubt      ?? "");

  const dttosFed = useMemo(
    () => ensureOption([...new Set(catalogo.map(r => r.dtto_fed))].filter(Boolean).sort(), curDttoFed),
    [catalogo, curDttoFed]
  );

  const dttosLoc = useMemo(() => {
    const base = curDttoFed ? catalogo.filter(r => r.dtto_fed === curDttoFed) : catalogo;
    return ensureOption([...new Set(base.map(r => r.dtto_loc))].filter(Boolean).sort(), curDttoLoc);
  }, [catalogo, curDttoFed, curDttoLoc]);

  const sectores = useMemo(() => {
    let base = catalogo;
    if (curDttoFed) base = base.filter(r => r.dtto_fed === curDttoFed);
    if (curDttoLoc) base = base.filter(r => r.dtto_loc === curDttoLoc);
    return ensureOption([...new Set(base.map(r => r.poligono))].filter(Boolean).sort(), curPoligono);
  }, [catalogo, curDttoFed, curDttoLoc, curPoligono]);

  const secciones = useMemo(() => {
    let base = catalogo;
    if (curPoligono) base = base.filter(r => r.poligono === curPoligono);
    return ensureOption(
      [...new Set(base.map(r => r.seccion))].filter(Boolean).sort((a, b) => Number(a) - Number(b)),
      curSeccion
    );
  }, [catalogo, curPoligono, curSeccion]);

  const ubts = useMemo(() => {
    if (!curSeccion) return ensureOption([], curUbt);
    return ensureOption(
      catalogo.filter(r => r.seccion === curSeccion).map(r => r.fraccion).filter(Boolean).sort(),
      curUbt
    );
  }, [catalogo, curSeccion, curUbt]);

  // ── handlers de cascada ─────────────────────────────────────────────────────

  const set = (field, value) => setCiudadano(prev => ({ ...prev, [field]: value }));

  const handleDttoFed = val =>
    setCiudadano(prev => ({ ...prev, dtto_fed: val, dtto_loc: "", poligono: "", seccion: "", ubt: "" }));
  const handleDttoLoc = val =>
    setCiudadano(prev => ({ ...prev, dtto_loc: val, poligono: "", seccion: "", ubt: "" }));
  const handleSector = val =>
    setCiudadano(prev => ({ ...prev, poligono: val, seccion: "", ubt: "" }));
  const handleSeccion = val => {
    // Al cambiar sección, auto-rellena los campos superiores desde el catálogo
    const row = catalogo.find(
      r => r.seccion === String(val) && (!curPoligono || r.poligono === curPoligono)
    );
    setCiudadano(prev => ({
      ...prev,
      seccion: val,
      ubt: "",
      ...(row ? { dtto_fed: row.dtto_fed, dtto_loc: row.dtto_loc, poligono: row.poligono } : {}),
    }));
  };

  // ── upload de fotos ─────────────────────────────────────────────────────────

  async function handleFileUpload(e, fieldName) {
    const file = e.target.files[0];
    if (!file || !ciudadano) return;
    setUploading(prev => ({ ...prev, [fieldName]: true }));
    const filePath = `ciudadanos/${fieldName}-${ciudadano.curp}`;
    const { error } = await supabase.storage.from("fotos_estructura").upload(filePath, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("fotos_estructura").getPublicUrl(filePath);
      set(fieldName, urlData.publicUrl);
    }
    setUploading(prev => ({ ...prev, [fieldName]: false }));
  }

  function handleUbicacion() {
    if (!navigator.geolocation) { alert("Geolocalización no disponible."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCiudadano(prev => ({ ...prev, latitud: coords.latitude, longitud: coords.longitude })),
      err => alert("Error: " + err.message)
    );
  }

  // ── guardar ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("ciudadania").update({
      usuario: ciudadano.usuario, password: ciudadano.password,
      dtto_fed: ciudadano.dtto_fed, dtto_loc: ciudadano.dtto_loc,
      poligono: ciudadano.poligono, seccion: ciudadano.seccion, ubt: ciudadano.ubt,
      nombre: ciudadano.nombre, a_paterno: ciudadano.a_paterno, a_materno: ciudadano.a_materno,
      curp: ciudadano.curp, telefono_1: ciudadano.telefono_1, telefono_2: ciudadano.telefono_2,
      ingreso_estructura: ciudadano.ingreso_estructura, observaciones: ciudadano.observaciones,
      calle: ciudadano.calle, n_ext_mz: ciudadano.n_ext_mz, n_int_lt: ciudadano.n_int_lt,
      n_casa: ciudadano.n_casa, movilizador: ciudadano.movilizador, c_p: ciudadano.c_p,
      col_loc: ciudadano.col_loc, latitud: ciudadano.latitud, longitud: ciudadano.longitud,
      url_foto_perfil: ciudadano.url_foto_perfil, url_foto_ine1: ciudadano.url_foto_ine1,
      url_foto_ine2: ciudadano.url_foto_ine2, cuenta_inst: ciudadano.cuenta_inst,
      cuenta_fb: ciudadano.cuenta_fb, cuenta_x: ciudadano.cuenta_x,
    }).eq("id", id);
    setSaving(false);
    if (error) alert("Error al guardar: " + error.message);
    else alert("Datos actualizados correctamente");
  }

  // ── renders ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Cargando ficha…</p>
      </div>
    </div>
  );

  if (!ciudadano) return <p className="p-4 text-red-500">Ciudadano no encontrado.</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white text-sm">
          ← Regresar
        </button>
        <h1 className="text-white font-bold text-sm">Ficha del Ciudadano</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-blue-700 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-60 transition-colors"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {/* Contenido — ancho amplio en desktop */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Fotografías ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Fotografías</SectionTitle>
          {/* En desktop: 3 columnas; en móvil: una columna */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
            <PhotoCard
              url={ciudadano.url_foto_perfil}
              alt="Foto de perfil"
              shape="portrait"
              onUpload={e => handleFileUpload(e, "url_foto_perfil")}
              uploading={uploading.url_foto_perfil}
            />
            <PhotoCard
              url={ciudadano.url_foto_ine1}
              alt="INE Frente"
              shape="landscape"
              onUpload={e => handleFileUpload(e, "url_foto_ine1")}
              uploading={uploading.url_foto_ine1}
            />
            <PhotoCard
              url={ciudadano.url_foto_ine2}
              alt="INE Reverso"
              shape="landscape"
              onUpload={e => handleFileUpload(e, "url_foto_ine2")}
              uploading={uploading.url_foto_ine2}
            />
          </div>
        </div>

        {/* ── Ubicación territorial ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Ubicación Territorial</SectionTitle>
          {viewerEsSM ? (
            <div className="grid grid-cols-3 gap-3">
              {[["Sector", ciudadano.poligono], ["Sección", ciudadano.seccion], ["Fracción", ciudadano.ubt]].map(([label, val]) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                  <p className="text-lg font-bold text-slate-800">{val || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Field label="Distrito Federal">
                <select className={selectCls} value={curDttoFed} onChange={e => handleDttoFed(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {dttosFed.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Distrito Local">
                <select className={selectCls} value={curDttoLoc} onChange={e => handleDttoLoc(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {dttosLoc.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Sector (Polígono)">
                <select className={selectCls} value={curPoligono} onChange={e => handleSector(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {sectores.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Sección">
                <select className={selectCls} value={curSeccion} onChange={e => handleSeccion(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {secciones.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Fracción (UBT)">
                <select
                  className={selectCls}
                  value={curUbt}
                  onChange={e => set("ubt", e.target.value)}
                  disabled={!curSeccion && ubts.length <= 1}
                >
                  <option value="">Seleccionar…</option>
                  {ubts.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        {/* ── Datos personales ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Datos Personales</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nombre">
              <input className={inputCls} value={ciudadano.nombre || ""} onChange={e => set("nombre", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Apellido Paterno">
              <input className={inputCls} value={ciudadano.a_paterno || ""} onChange={e => set("a_paterno", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Apellido Materno">
              <input className={inputCls} value={ciudadano.a_materno || ""} onChange={e => set("a_materno", e.target.value.toUpperCase())} />
            </Field>
            <Field label="CURP">
              <input className={inputCls} value={ciudadano.curp || ""} maxLength="18" onChange={e => set("curp", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Teléfono">
              <input className={inputCls} value={ciudadano.telefono_1 || ""} maxLength="10" onChange={e => set("telefono_1", e.target.value)} />
            </Field>
            <Field label="Teléfono Alterno">
              <input className={inputCls} value={ciudadano.telefono_2 || ""} maxLength="10" onChange={e => set("telefono_2", e.target.value)} />
            </Field>
            <Field label="Ingreso a la Estructura">
              <input type="date" className={inputCls} value={ciudadano.ingreso_estructura || ""} onChange={e => set("ingreso_estructura", e.target.value)} />
            </Field>
            <Field label="Movilizador">
              <input className={inputCls} value={ciudadano.movilizador || ""} onChange={e => set("movilizador", e.target.value.toUpperCase())} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-1">
              <Field label="Observaciones">
                <input className={inputCls} value={ciudadano.observaciones || ""} onChange={e => set("observaciones", e.target.value.toUpperCase())} />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Acceso al sistema ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Acceso al Sistema</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Usuario">
              <input className={inputCls} value={ciudadano.usuario || ""} onChange={e => set("usuario", e.target.value)} />
            </Field>
            <Field label="Contraseña">
              <input className={inputCls} value={ciudadano.password || ""} maxLength="18" onChange={e => set("password", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ── Domicilio + Mapa ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Domicilio</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <Field label="Calle">
              <input className={inputCls} value={ciudadano.calle || ""} onChange={e => set("calle", e.target.value)} />
            </Field>
            <Field label="N° Ext (MZ)">
              <input className={inputCls} value={ciudadano.n_ext_mz || ""} onChange={e => set("n_ext_mz", e.target.value)} />
            </Field>
            <Field label="N° Int (LT)">
              <input className={inputCls} value={ciudadano.n_int_lt || ""} onChange={e => set("n_int_lt", e.target.value)} />
            </Field>
            <Field label="N° Casa">
              <input className={inputCls} value={ciudadano.n_casa || ""} onChange={e => set("n_casa", e.target.value)} />
            </Field>
            <Field label="Código Postal">
              <input className={inputCls} value={ciudadano.c_p || ""} onChange={e => set("c_p", e.target.value)} />
            </Field>
            <Field label="Localidad / Colonia">
              <input className={inputCls} value={ciudadano.col_loc || ""} onChange={e => set("col_loc", e.target.value)} />
            </Field>
          </div>
          {!viewerEsSM && (
            <>
              <button
                type="button"
                onClick={handleUbicacion}
                className="mb-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                📍 Usar mi ubicación actual
              </button>
              <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 320 }}>
                <MapTerritorial
                  secciones={seccionGeo ? [seccionGeo] : []}
                  fraccionesGeo={fracciones}
                  selectedSeccion={seccionGeo?.seccion}
                  editableLocation={
                    ciudadano.latitud && ciudadano.longitud
                      ? { lat: Number(ciudadano.latitud), lng: Number(ciudadano.longitud) }
                      : null
                  }
                  onEditableLocationChange={(lat, lng, fraccion) =>
                    setCiudadano(prev => ({
                      ...prev, latitud: lat, longitud: lng,
                      ...(fraccion != null ? { ubt: fraccion } : {}),
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>

        {/* ── Redes sociales ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionTitle>Redes Sociales</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Instagram">
              <input className={inputCls} value={ciudadano.cuenta_inst || ""} onChange={e => set("cuenta_inst", e.target.value)} />
            </Field>
            <Field label="Facebook">
              <input className={inputCls} value={ciudadano.cuenta_fb || ""} onChange={e => set("cuenta_fb", e.target.value)} />
            </Field>
            <Field label="X (Twitter)">
              <input className={inputCls} value={ciudadano.cuenta_x || ""} onChange={e => set("cuenta_x", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Guardar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md shadow-blue-200/50 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition-all text-sm"
        >
          {saving ? "Guardando cambios…" : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
};

export default FichaCiudadano;
