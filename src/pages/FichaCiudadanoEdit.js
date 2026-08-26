import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase, { supabaseStorage } from "../supabase/client";

// ── Zona de arrastre para fotos ────────────────────────────────────────────────
const DropZonePhoto = ({ fieldName, label, shape, url, uploading, onFile }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const isLandscape = shape === "landscape";
  const containerCls = isLandscape
    ? "w-full h-36"   // credencial INE
    : "w-full h-52";  // foto perfil

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFile(file, fieldName);
  };
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFile(file, fieldName);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <div
        className={`${containerCls} relative rounded-xl border-2 transition-all duration-200 overflow-hidden cursor-pointer
          ${dragging
            ? "border-blue-500 bg-blue-50 scale-[1.01]"
            : url
            ? "border-slate-200"
            : "border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {/* Imagen actual */}
        {url && (
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover"
          />
        )}

        {/* Overlay al hacer drag */}
        {dragging && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center z-10">
            <p className="text-blue-700 font-bold text-sm">Suelta la imagen aquí</p>
          </div>
        )}

        {/* Spinner mientras sube */}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="w-6 h-6 rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Placeholder cuando no hay imagen */}
        {!url && !uploading && !dragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-xs text-slate-400 text-center px-4">Arrastra o toca para subir</p>
          </div>
        )}

        {/* Botón editar encima de la imagen */}
        {url && !uploading && !dragging && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200">
            <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-lg">
              Cambiar foto
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </div>
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
    async function fetchCiudadano() {
      const { data, error } = await supabase
        .from("ciudadania")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error obteniendo ciudadano:", error);
        setError("Error al cargar los datos del ciudadano");
      } else {
        setCiudadano(data);
      }
      setLoading(false);
    }
    fetchCiudadano();
  }, [id]);

  useEffect(() => {
    const loadSectionData = async () => {
      if (!ciudadano?.seccion) return;

      setLoading(true);
      try {
        const { data: ubtData, error: ubtError } = await supabase
          .from("ubt_catalogo")
          .select("fraccion")
          .eq("seccion", ciudadano.seccion);

        if (ubtError) throw ubtError;
        setUbts(ubtData.map((item) => item.fraccion).filter(Boolean));
      } catch (err) {
        console.error("Error loading section data:", err);
        setError("Error al cargar datos de la sección");
      } finally {
        setLoading(false);
      }
    };

    if (ciudadano) loadSectionData();
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
        })
        .eq("id", ciudadano.id);

      if (error) throw error;
      alert("Datos actualizados correctamente");
      navigate(-1);
    } catch (err) {
      console.error("Error actualizando ciudadano:", err);
      setError("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCiudadano((prev) => ({
      ...prev,
      [name]:
        name === "curp" || name === "nombre" || name === "a_paterno" || name === "a_materno"
          ? value.toUpperCase()
          : value,
    }));
  };

  // ── Upload de foto (drag-drop o selector) ─────────────────────────────────────
  async function handlePhotoFile(file, fieldName) {
    if (!ciudadano) return;
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
      if (dbError) alert("Foto subida pero error al guardar en base de datos: " + dbError.message);
    }
    setUploading((prev) => ({ ...prev, [fieldName]: false }));
  }

  if (loading && !ciudadano) return <p className="p-4">Cargando...</p>;
  if (!ciudadano) return <p className="p-4">No se encontró el ciudadano</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Editar Ficha del Ciudadano</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* ── Fotos ── */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm font-bold text-slate-700 mb-4">Fotografías</p>
        <p className="text-xs text-slate-400 mb-4">
          Arrastra una imagen directamente sobre el recuadro o tócalo para seleccionar desde tus archivos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DropZonePhoto
            fieldName="url_foto_perfil"
            label="Foto de perfil"
            shape="portrait"
            url={ciudadano.url_foto_perfil}
            uploading={uploading.url_foto_perfil}
            onFile={handlePhotoFile}
          />
          <DropZonePhoto
            fieldName="url_foto_ine1"
            label="INE (frente)"
            shape="landscape"
            url={ciudadano.url_foto_ine1}
            uploading={uploading.url_foto_ine1}
            onFile={handlePhotoFile}
          />
          <DropZonePhoto
            fieldName="url_foto_ine2"
            label="INE (reverso)"
            shape="landscape"
            url={ciudadano.url_foto_ine2}
            uploading={uploading.url_foto_ine2}
            onFile={handlePhotoFile}
          />
        </div>
      </div>

      {/* ── Campos de texto ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UBT */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">UBT:</label>
          {ubts.length > 0 ? (
            <select
              name="ubt"
              value={ciudadano.ubt || ""}
              onChange={handleChange}
              className="border border-gray-300 rounded-md p-2 w-full"
            >
              <option value="">Seleccionar UBT</option>
              {ubts.map((ubt, i) => (
                <option key={i} value={ubt}>{ubt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              name="ubt"
              value={ciudadano.ubt || ""}
              onChange={handleChange}
              className="border p-2 w-full rounded-md"
            />
          )}
        </div>

        {/* Puesto */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Puesto:</label>
          <select
            name="puesto"
            value={ciudadano.puesto || ""}
            onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full"
          >
            <option value="">Seleccionar puesto</option>
            {puestosc.map((p, i) => (
              <option key={i} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Campos de texto genéricos */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}:
            </label>
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
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-green-300"
        >
          {loading ? "Guardando..." : "Guardar Cambios"}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default FichaCiudadanoEdit;
