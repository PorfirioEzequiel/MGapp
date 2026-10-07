import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase, { supabaseStorage as supabaseAdmin } from "../supabase/client";
import MapTerritorial from "../map/MapTerritorial";
import { changedCitizenFields, hasAssignmentChanges, validateSmAssignment, SM_ASSIGNMENT_FIELDS } from "../utils/smAssignment";
import { SMField as Field, SMSectionTitle as SectionTitle, HomeLocationNote, SMSaveConfirmation } from '../componentes/SMFormUI';
import { FiArrowLeft, FiGrid, FiMapPin, FiSave, FiImage, FiUser } from 'react-icons/fi';

// ── helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'sm-control';
const selectCls = 'sm-control';

// Garantiza que el valor actual siempre aparezca en las opciones
const ensureOption = (options, value) => {
  const sv = String(value ?? "");
  if (!sv || options.some(o => String(o) === sv)) return options;
  return [sv, ...options];
};

// ── foto card ────────────────────────────────────────────────────────────────

const PhotoCard = ({ url, alt, shape, onUpload, uploading }) => {
  const [dragging, setDragging] = useState(false);

  const containerCls =
    shape === "landscape"
      ? "w-full max-w-xs h-36"
      : "w-28 h-36";

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = ()  => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/"))
      onUpload({ target: { files: [file] } });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${containerCls} relative rounded-xl overflow-hidden border bg-[#f2eeea] flex items-center justify-center transition-all duration-150
          ${dragging ? "border-[#7b1528] bg-[#f6edef]" : "border-[#e7e0da]"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {url ? (
          <img
            key={url}
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
          <FiImage className="text-3xl text-[#aa8958]" aria-hidden="true" />
          <span className="text-[11px] text-[#75666a] mt-1 text-center px-2">Arrastra o usa el botón</span>
        </div>

        {/* Overlay al arrastrar */}
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#7b1528]/10 z-10">
            <p className="text-[#7b1528] font-bold text-sm bg-white/90 px-3 py-1.5 rounded-lg shadow">
              Suelta aquí
            </p>
          </div>
        )}

        {/* Spinner mientras sube */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <span className="sm-spinner text-[#7b1528]" />
          </div>
        )}
      </div>

      <label className="cursor-pointer">
        <span className="sm-button sm-button-secondary">
          {uploading ? "Subiendo…" : "Cambiar foto"}
        </span>
        <input type="file" accept="image/*" aria-label={`Cambiar ${alt}`} className="sr-only" onChange={onUpload} disabled={uploading} />
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
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState({});
  const [seccionGeo, setSeccionGeo] = useState(null);
  const [fracciones, setFracciones] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [smData, setSmData] = useState(null);

  let viewer = null;
  try { viewer = JSON.parse(sessionStorage.getItem("user")); } catch { viewer = null; }
  const viewerEsSM = viewer?.puesto?.toUpperCase() === "SM";
  const viewerEsSP = viewer?.puesto?.toUpperCase() === "SP";
  const viewerPoligono = viewer?.poligono != null ? String(viewer.poligono) : null;

  // Cargar ciudadano
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from("ciudadania").select("*").eq("id", id).single().then(({ data, error }) => {
      if (cancelled) return;
      setCiudadano(error ? null : data);
      setOriginal(error ? null : data);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setCiudadano(null); setOriginal(null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [id]);

  // Cargar catálogo completo para los selects en cascada
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("ubt_catalogo")
      .select("dtto_fed, dtto_loc, sector, seccion, fraccion")
      .limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.length) throw new Error('Catálogo no disponible');
        const norm = data.map(r => ({
          ...r,
          poligono: String(r.sector ?? ""),
          seccion: String(r.seccion ?? ""),
          fraccion: String(r.fraccion ?? ""),
          dtto_fed: String(r.dtto_fed ?? ""),
          dtto_loc: String(r.dtto_loc ?? ""),
        }));
        setCatalogo(norm);
      }).catch(() => {
        if (!cancelled) setCatalogError('No se pudo cargar el catálogo. Recarga la ficha para cambiar la asignación. Puedes guardar cambios en el domicilio.');
      }).finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Datos territoriales derivados de la SM (solo para movilizadores)
  useEffect(() => {
    let cancelled = false;
    const esMovilizador = ciudadano?.puesto?.toUpperCase() === 'MOVILIZADOR';
    const smUsuario = ciudadano?.movilizador;
    setSmData(null);
    if (!esMovilizador || !smUsuario) return;
    supabase
      .from('ciudadania')
      .select('nombre, a_paterno, a_materno, seccion, poligono, ubt')
      .eq('usuario', smUsuario)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSmData(data ?? null);
        if (!data) return;
        // Auto-populate territorial fields if the movilizador's own fields are empty
        setCiudadano(prev => {
          if (!prev || prev.movilizador !== smUsuario) return prev;
          const sinPoligono = prev.poligono == null || prev.poligono === '';
          const sinSeccion  = prev.seccion  == null || prev.seccion  === '';
          const sinUbt      = prev.ubt      == null || prev.ubt      === '';
          if (!sinPoligono && !sinSeccion && !sinUbt) return prev;
          return {
            ...prev,
            poligono: sinPoligono ? (data.poligono ?? prev.poligono) : prev.poligono,
            seccion:  sinSeccion  ? (data.seccion  ?? prev.seccion)  : prev.seccion,
            ubt:      sinUbt      ? (data.ubt      ?? prev.ubt)      : prev.ubt,
          };
        });
      }).catch(() => {
        if (!cancelled) setSmData(null);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ciudadano?.puesto, ciudadano?.movilizador]);

  // Geometría de la sección para el mapa
  useEffect(() => {
    let cancelled = false;
    setSeccionGeo(null);
    setFracciones([]);
    if (!ciudadano?.seccion) return;
    const num = Number(ciudadano.seccion);
    Promise.all([
      supabase.from("secciones").select("*").eq("seccion", num).maybeSingle(),
      supabase.from("fracciones").select("fraccion, seccion, geometry").eq("seccion", num),
    ]).then(([sec, frac]) => {
      if (cancelled) return;
      setSeccionGeo(sec.data ?? null);
      setFracciones(frac.data ?? []);
    }).catch(() => { /* El domicilio sigue siendo independiente de la geometría. */ });
    return () => { cancelled = true; };
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
    const options = viewerEsSP ? [viewerPoligono].filter(Boolean) : [...new Set(catalogo.map(r => r.poligono))].filter(Boolean).sort((a, b) => a - b);
    return ensureOption(options, curPoligono);
  }, [catalogo, curPoligono, viewerEsSP, viewerPoligono]);

  const secciones = useMemo(
    () => ensureOption([...new Set(catalogo.filter(r => r.poligono === curPoligono).map(r => r.seccion))].sort((a, b) => a - b), curSeccion),
    [catalogo, curPoligono, curSeccion]
  );

  const ubts = useMemo(() => {
    // Todos los selects derivan del mismo catálogo: no hay respuestas de otra sección.
    if (!curSeccion) return ensureOption([], curUbt);
    const fromCatalog = [...new Set(
      catalogo.filter(r => r.seccion === curSeccion && r.poligono === curPoligono).map(r => r.fraccion).filter(Boolean)
    )].sort();
    return ensureOption(fromCatalog, curUbt);
  }, [catalogo, curPoligono, curSeccion, curUbt]);

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
    const input = e.target;
    const file = input.files[0];
    if (!file || !ciudadano || saving || uploading[fieldName]) return;
    if (original?.puesto?.toUpperCase() === 'SM' && viewerEsSP && String(original.poligono ?? '') !== viewerPoligono) {
      alert('Esta SM no pertenece a tu sector. Solicita la revisión al administrador.');
      return;
    }
    if (!ciudadano.curp) { alert("El registro no tiene CURP. Guarda primero el CURP para poder subir fotos."); return; }
    setUploading(prev => ({ ...prev, [fieldName]: true }));
    const filePath = `ciudadanos/${fieldName}-${ciudadano.curp}`;
    try {
      const { error: uploadError } = await supabaseAdmin.storage
        .from("fotos_estructura")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabaseAdmin.storage.from("fotos_estructura").getPublicUrl(filePath);
      const urlFinal = `${urlData.publicUrl}?t=${Date.now()}`;
      set(fieldName, urlFinal);
      const { data: savedPhoto, error: dbError } = await supabase.from("ciudadania")
        .update({ [fieldName]: urlFinal }).eq("id", id).select('id').maybeSingle();
      if (dbError || !savedPhoto) alert("Foto subida pero error al guardar en base de datos: " + (dbError?.message || 'El registro no pudo actualizarse.'));
      else setOriginal(prev => ({ ...prev, [fieldName]: urlFinal }));
    } catch (error) {
      alert("Error al subir la foto: " + error.message);
    } finally {
      input.value = '';
      setUploading(prev => ({ ...prev, [fieldName]: false }));
    }
  }

  function handleUbicacion() {
    if (!navigator.geolocation) { alert("Geolocalización no disponible."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCiudadano(prev => ({ ...prev, latitud: coords.latitude, longitud: coords.longitude })),
      err => alert("Error: " + err.message)
    );
  }

  // ── guardar ─────────────────────────────────────────────────────────────────

  async function handleSave(confirmed = false) {
    if (saving || Object.values(uploading).some(Boolean) || !original) return;
    const esSM = original.puesto?.toUpperCase() === 'SM';
    const assignmentChanged = esSM && hasAssignmentChanges(original, ciudadano);
    if (esSM && viewerEsSP && String(original.poligono ?? '') !== viewerPoligono) {
      alert('Esta SM no pertenece a tu sector. Solicita la revisión al administrador.');
      return;
    }
    if (assignmentChanged) {
      const validationError = catalogLoading ? 'Espera a que cargue el catálogo de asignaciones.'
        : catalogError || validateSmAssignment(ciudadano, catalogo, viewerEsSP ? viewerPoligono : null);
      if (validationError) { alert(validationError); return; }
    }
    if (confirmed !== true) { setConfirmOpen(true); return; }
    setSaving(true);
    const toInt = (v) => { const n = parseInt(String(v ?? ""), 10); return Number.isFinite(n) ? n : null; };
    const payload = {
      usuario: ciudadano.usuario, password: ciudadano.password,
      dtto_fed: ciudadano.dtto_fed || null, dtto_loc: ciudadano.dtto_loc || null,
      poligono: toInt(ciudadano.poligono), seccion: toInt(ciudadano.seccion), ubt: ciudadano.ubt || null,
      nombre: ciudadano.nombre, a_paterno: ciudadano.a_paterno, a_materno: ciudadano.a_materno,
      curp: ciudadano.curp, telefono_1: ciudadano.telefono_1, telefono_2: ciudadano.telefono_2,
      ingreso_estructura: ciudadano.ingreso_estructura, observaciones: ciudadano.observaciones,
      calle: ciudadano.calle, n_ext_mz: ciudadano.n_ext_mz, n_int_lt: ciudadano.n_int_lt,
      n_casa: ciudadano.n_casa, movilizador: ciudadano.movilizador, c_p: ciudadano.c_p,
      col_loc: ciudadano.col_loc, latitud: ciudadano.latitud, longitud: ciudadano.longitud,
      url_foto_perfil: ciudadano.url_foto_perfil, url_foto_ine1: ciudadano.url_foto_ine1,
      url_foto_ine2: ciudadano.url_foto_ine2, cuenta_inst: ciudadano.cuenta_inst,
      cuenta_fb: ciudadano.cuenta_fb, cuenta_x: ciudadano.cuenta_x,
    };
    try {
      const changes = esSM ? changedCitizenFields(original, payload) : payload;
      if (!Object.keys(changes).length) { alert('No hay cambios para guardar.'); return; }
      let query = supabaseAdmin.from('ciudadania').update(changes).eq('id', id);
      if (esSM) {
        query = query.eq('puesto', original.puesto);
        if (viewerEsSP) query = query.eq('poligono', original.poligono);
        // Si alguien reasignó la SM mientras la ficha estaba abierta, pedir recargar.
        if (assignmentChanged) {
          SM_ASSIGNMENT_FIELDS.forEach(field => {
            query = original[field] == null ? query.is(field, null) : query.eq(field, original[field]);
          });
        }
      }
      const { data, error } = await query.select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('El registro cambió o no pudo actualizarse. Recarga la ficha antes de guardar.');
      setOriginal(prev => ({ ...prev, ...changes }));
      alert('Datos actualizados correctamente');
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  // ── renders ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="sm-form-theme sm-form-page flex items-center justify-center">
      <div className="text-center">
        <span className="sm-spinner text-[#7b1528] mb-3" aria-hidden="true" />
        <p className="sm-form-description" role="status">Cargando ficha…</p>
      </div>
    </div>
  );

  if (!ciudadano) return <p className="p-4 text-red-500">Ciudadano no encontrado.</p>;

  return (
    <div className="sm-form-theme sm-form-page">
      {/* Header */}
      <header className="sm-form-header"><div className="sm-form-header-inner">
        <button onClick={() => navigate(-1)} className="sm-back" aria-label="Regresar al panel">
          <FiArrowLeft aria-hidden="true" />
        </button>
        <div><p className="sm-eyebrow">Estructura territorial · Edición</p><h1>{ciudadano.puesto?.toUpperCase() === 'SM' ? 'Ficha de SM' : 'Ficha del Ciudadano'}</h1></div>
        <button
          onClick={handleSave}
          disabled={saving || Object.values(uploading).some(Boolean)}
          className="sm-button sm-button-primary sm-header-action"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div></header>

      {/* Contenido — ancho amplio en desktop */}
      <div className="sm-form-main space-y-5">
        <div className="sm-form-intro"><div><h2>{[ciudadano.nombre, ciudadano.a_paterno, ciudadano.a_materno].filter(Boolean).join(' ')}</h2><p>Revisa sus datos, la asignación de trabajo y el domicilio.</p></div></div>

        {/* ── Fotografías ── */}
        <div className="sm-form-card">
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
        <div className="sm-form-card">
          <SectionTitle>Asignación de trabajo</SectionTitle>

          {/* Banner con datos derivados de la SM (solo movilizadores) */}
          {smData && (
            <div className="sm-responsible" aria-label="SM responsable de este movilizador">
              <div className="sm-responsible-heading"><FiUser aria-hidden="true" /><div>
                <p>SM responsable de este movilizador</p>
                <strong>{[smData.nombre, smData.a_paterno, smData.a_materno].filter(Boolean).join(' ')}</strong>
              </div></div>
              <dl className="sm-responsible-territory">
                {smData.poligono != null && smData.poligono !== '' && (
                  <div><dt>Sector</dt><dd>{smData.poligono}</dd></div>
                )}
                {smData.seccion != null && smData.seccion !== '' && (
                  <div><dt>Sección</dt><dd>{smData.seccion}</dd></div>
                )}
                {smData.ubt != null && smData.ubt !== '' && (
                  <div><dt>Fracción (UBT)</dt><dd>{smData.ubt}</dd></div>
                )}
              </dl>
              <p className="sm-responsible-caption">Este movilizador está asignado a la SM indicada. Estos datos corresponden a su estructura de trabajo.</p>
            </div>
          )}

          {ciudadano.puesto?.toUpperCase() === 'SM' && (
            <div className="sm-assignment-note"><FiGrid aria-hidden="true" /><p>La <strong>Fracción (UBT)</strong> indica dónde trabaja la SM. El domicilio se marca por separado en el mapa.</p></div>
          )}
          {catalogLoading && <p role="status" className="text-xs text-slate-500 mb-3">Cargando asignaciones…</p>}
          {catalogError && <p role="alert" className="text-xs text-amber-700 mb-3">{catalogError}</p>}
          <fieldset disabled={catalogLoading || Boolean(catalogError) || saving} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                disabled={!curSeccion}
              >
                <option value="">Seleccionar…</option>
                {ubts.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </fieldset>
        </div>

        {/* ── Datos personales ── */}
        <div className="sm-form-card">
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
        <div className="sm-form-card">
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
        <div className="sm-form-card">
          <SectionTitle hint="Dirección donde vive la persona.">Dónde vive</SectionTitle>
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
              <div className="sm-map-intro"><h3>Domicilio en el mapa</h3>
                <p>Aquí marcas dónde vive {ciudadano.puesto?.toUpperCase() === 'SM' ? 'la SM' : 'la persona'}. Puede vivir fuera de la fracción donde trabaja.</p>
              </div>
              <HomeLocationNote citizen={ciudadano} />
              <button
                type="button"
                onClick={handleUbicacion}
                className="sm-button sm-button-secondary"
              >
                <FiMapPin aria-hidden="true" /> Usar mi ubicación actual
              </button>
              <p className="sm-form-description mt-2">Úsala si estás en este domicilio. También puedes buscar la dirección y ajustar el pin.</p>
              <div className="sm-location-map">
                <MapTerritorial
                  locationOnly
                  secciones={seccionGeo ? [seccionGeo] : []}
                  fraccionesGeo={fracciones}
                  selectedSeccion={seccionGeo?.seccion}
                  editableLocation={
                    ciudadano.latitud && ciudadano.longitud
                      ? { lat: Number(ciudadano.latitud), lng: Number(ciudadano.longitud) }
                      : null
                  }
                  onEditableLocationChange={(lat, lng) =>
                    setCiudadano(prev => ({ ...prev, latitud: lat, longitud: lng }))
                  }
                />
              </div>
            </>
          )}
        </div>

        {/* ── Redes sociales ── */}
        <div className="sm-form-card">
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
        <div className="sm-form-savebar">
        <p><strong>Revisa antes de guardar</strong>Comprueba el domicilio y la asignación de trabajo.</p>
        <button
          onClick={handleSave}
          disabled={saving || Object.values(uploading).some(Boolean)}
          className="sm-button sm-button-primary"
        >
          {saving ? <span className="sm-spinner" aria-hidden="true" /> : <FiSave aria-hidden="true" />}{saving ? "Guardando cambios…" : "Guardar Cambios"}
        </button>
        </div>
      </div>
      <SMSaveConfirmation open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleSave(true)} busy={saving} citizen={ciudadano} editing />
    </div>
  );
};

export default FichaCiudadano;
