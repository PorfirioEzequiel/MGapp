import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase, { supabaseStorage } from "../supabase/client";

// ── Tarjeta de foto con drag-and-drop ─────────────────────────────────────────
const PhotoCard = ({ fieldName, label, shape, url, uploading, onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const containerCls = shape === "landscape" ? "w-full h-36" : "w-full h-52";

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = ()  => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/"))
      onUpload({ target: { files: [file] } }, fieldName);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>

      {/* Área de foto — arrastra aquí o pulsa el botón */}
      <div
        className={`${containerCls} relative rounded-xl overflow-hidden border-2 shadow-sm bg-slate-100 flex items-center justify-center transition-all duration-150
          ${dragging ? "border-blue-500 bg-blue-50 scale-[1.02]" : "border-slate-200"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {url && <img src={url} alt={label} className="w-full h-full object-cover" />}

        {!url && (
          <div className="flex flex-col items-center justify-center gap-2 select-none">
            <span className="text-3xl">📷</span>
            <p className="text-xs text-slate-400 text-center px-4">Arrastra o usa el botón</p>
          </div>
        )}

        {/* Overlay al arrastrar */}
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 z-10">
            <p className="text-blue-700 font-bold text-sm bg-white/90 px-3 py-1.5 rounded-lg shadow">
              Suelta aquí
            </p>
          </div>
        )}

        {/* Spinner mientras sube */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="w-5 h-5 rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Botón selector de archivo */}
      <label className="cursor-pointer">
        <span className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors block text-center">
          {uploading ? "Subiendo…" : "Seleccionar archivo"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onUpload(e, fieldName)}
          disabled={uploading}
        />
      </label>
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────
const FichaCiudadanoEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ciudadano, setCiudadano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ubts, setUbts] = useState([]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState({});
  const puestosc = ["MOVILIZADOR", "INVITADO"];

  useEffect(() => {
    supabase
      .from("ciudadania")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error) setError("Error al cargar los datos del ciudadano");
        else setCiudadano(data);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!ciudadano?.seccion) return;
    supabase
      .from("ubt_catalogo")
      .select("fraccion")
      .eq("seccion", ciudadano.seccion)
      .then(({ data }) => setUbts((data ?? []).map((r) => r.fraccion).filter(Boolean)));
  }, [ciudadano?.seccion]);

  async function handleSave() {
    if (!ciudadano) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("ciudadania")
        .update({
          ubt: ciudadano.ubt,
          nombre: ciudadano.nombre,
          a_paterno: ciudadano.a_paterno,
          a_materno: ciudadano.a_materno,
          puesto: ciudadano.puesto,
          curp: ciudadano.curp,
          telefono_1: ciudadano.telefono_1,
          calle: ciudadano.calle,
          n_ext_mz: ciudadano.n_ext_mz,
          n_int_lt: ciudadano.n_int_lt,
          n_casa: ciudadano.n_casa,
          movilizador: ciudadano.movilizador,
          c_p: ciudadano.c_p,
          col_loc: ciudadano.col_loc,
          seccion: ciudadano.seccion ? parseInt(ciudadano.seccion, 10) : null,
          poligono: ciudadano.poligono ? parseInt(ciudadano.poligono, 10) : null,
        })
        .eq("id", ciudadano.id);
      if (error) throw error;
      alert("Datos actualizados correctamente");
      navigate(-1);
    } catch (err) {
      setError("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCiudadano((prev) => ({
      ...prev,
      [name]: ["curp", "nombre", "a_paterno", "a_materno"].includes(name)
        ? value.toUpperCase()
        : value,
    }));
  };

  // Upload de foto — acepta evento de input o evento simulado desde drop
  async function handlePhotoUpload(e, fieldName) {
    const file = e.target.files[0];
    if (!file || !ciudadano) return;
    if (!ciudadano.curp) {
      alert("El registro no tiene CURP. Guarda primero el CURP para poder subir fotos.");
      return;
    }
    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    const filePath = `ciudadanos/${fieldName}-${ciudadano.curp}`;
    const { error: uploadError } = await supabaseStorage.storage
      .from("fotos_estructura")
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      alert("Error al subir la foto: " + uploadError.message);
    } else {
      const { data: urlData } = supabaseStorage.storage
        .from("fotos_estructura")
        .getPublicUrl(filePath);
      const urlFinal = `${urlData.publicUrl}?t=${Date.now()}`;
      setCiudadano((prev) => ({ ...prev, [fieldName]: urlFinal }));
      const { error: dbError } = await supabase
        .from("ciudadania")
        .update({ [fieldName]: urlFinal })
        .eq("id", id);
      if (dbError) alert("Foto subida pero error al guardar: " + dbError.message);
    }
    setUploading((prev) => ({ ...prev, [fieldName]: false }));
  }

  if (loading && !ciudadano) return <p className="p-4">Cargando...</p>;
  if (!ciudadano) return <p className="p-4">No se encontró el ciudadano</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Editar Ficha del Ciudadano</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* ── Fotos — arrastra directamente sobre la imagen ── */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm font-bold text-slate-700 mb-1">Fotografías</p>
        <p className="text-xs text-slate-400 mb-4">
          Arrastra una imagen encima del recuadro, o usa el botón para elegir desde tus archivos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PhotoCard
            fieldName="url_foto_perfil"
            label="Foto de perfil"
            shape="portrait"
            url={ciudadano.url_foto_perfil}
            uploading={uploading.url_foto_perfil}
            onUpload={handlePhotoUpload}
          />
          <PhotoCard
            fieldName="url_foto_ine1"
            label="INE — frente"
            shape="landscape"
            url={ciudadano.url_foto_ine1}
            uploading={uploading.url_foto_ine1}
            onUpload={handlePhotoUpload}
          />
          <PhotoCard
            fieldName="url_foto_ine2"
            label="INE — reverso"
            shape="landscape"
            url={ciudadano.url_foto_ine2}
            uploading={uploading.url_foto_ine2}
            onUpload={handlePhotoUpload}
          />
        </div>
      </div>

      {/* ── Campos de texto ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sector y Sección */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sector (Polígono):</label>
          <input
            type="number"
            name="poligono"
            value={ciudadano.poligono || ""}
            onChange={handleChange}
            placeholder="Ej. 6"
            className="border border-gray-300 rounded-md p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sección:</label>
          <input
            type="number"
            name="seccion"
            value={ciudadano.seccion || ""}
            onChange={handleChange}
            placeholder="Ej. 6264"
            className="border border-gray-300 rounded-md p-2 w-full"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">UBT:</label>
          {ubts.length > 0 ? (
            <select name="ubt" value={ciudadano.ubt || ""} onChange={handleChange}
              className="border border-gray-300 rounded-md p-2 w-full">
              <option value="">Seleccionar UBT</option>
              {ubts.map((u, i) => <option key={i} value={u}>{u}</option>)}
            </select>
          ) : (
            <input type="text" name="ubt" value={ciudadano.ubt || ""} onChange={handleChange}
              className="border border-gray-300 rounded-md p-2 w-full" />
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Puesto:</label>
          <select name="puesto" value={ciudadano.puesto || ""} onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full">
            <option value="">Seleccionar puesto</option>
            {puestosc.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>

        {[
          { name: "nombre",      label: "Nombre" },
          { name: "a_paterno",   label: "Apellido Paterno" },
          { name: "a_materno",   label: "Apellido Materno" },
          { name: "curp",        label: "CURP", maxLength: 18 },
          { name: "movilizador", label: "Movilizador" },
          { name: "telefono_1",  label: "Teléfono", maxLength: 10 },
          { name: "calle",       label: "Calle" },
          { name: "n_ext_mz",    label: "N° Ext (MZ)" },
          { name: "n_int_lt",    label: "N° Int (LT)" },
          { name: "n_casa",      label: "N° Casa" },
          { name: "c_p",         label: "Código Postal" },
          { name: "col_loc",     label: "Localidad o Colonia" },
        ].map((field) => (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}:</label>
            <input
              type="text"
              name={field.name}
              value={ciudadano[field.name] || ""}
              onChange={handleChange}
              maxLength={field.maxLength}
              className="border border-gray-300 rounded-md p-2 w-full"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-green-300">
          {loading ? "Guardando..." : "Guardar Cambios"}
        </button>
        <button onClick={() => navigate(-1)} className="bg-gray-500 text-white px-4 py-2 rounded">
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default FichaCiudadanoEdit;
