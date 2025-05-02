import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabase/client";

const FichaCiudadano = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ciudadano, setCiudadano] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchCiudadano() {
      const { data, error } = await supabase
        .from("ciudadania")
        .select("*")
        .eq("id", id)
        .single();

      if (error) console.error("Error obteniendo ciudadano:", error);
      else setCiudadano(data);
      setLoading(false);
    }
    fetchCiudadano();
  }, [id]);

  async function handleSave() {
    const { error } = await supabase
      .from("ciudadania")
      .update({
        usuario: ciudadano.usuario,
        password: ciudadano.password,
        dtto_fed: ciudadano.dtto_fed,
        dtto_loc: ciudadano.dtto_loc,
        poligono: ciudadano.poligono,
        seccion: ciudadano.seccion,
        nombre: ciudadano.nombre,
        a_paterno: ciudadano.a_paterno,
        a_materno: ciudadano.a_materno,
        curp: ciudadano.curp,
        telefono_1: ciudadano.telefono_1,
        telefono_2: ciudadano.telefono_2,
        ingreso_estructura: ciudadano.ingreso_estructura,
        observaciones: ciudadano.observaciones,
        calle: ciudadano.calle,
        n_ext_mz: ciudadano.n_ext_mz,
        n_int_lt: ciudadano.n_int_lt,
        n_casa: ciudadano.n_casa,
        c_p: ciudadano.c_p,
        col_loc: ciudadano.col_loc,
        url_foto_perfil: ciudadano.url_foto_perfil,
        url_foto_ine1: ciudadano.url_foto_ine1,
        url_foto_ine2: ciudadano.url_foto_ine2,
        cuenta_inst: ciudadano.cuenta_inst,
        cuenta_fb: ciudadano.cuenta_fb,
        cuenta_x: ciudadano.cuenta_x,

      })
      .eq("id", id);

    if (error) {
      console.error("Error actualizando ciudadano:", error);
    } else {
      alert("Datos actualizados correctamente");
    }
  }

  async function handleFileUpload(event, fieldName) {
    const file = event.target.files[0];
    if (!file) return;

    // const filePath = `ciudadanos/${id}/${fieldName}-${file.name}`;
    // const curp = nuevoCiudadano.curp.trim().toUpperCase();
    const filePath = `ciudadanos/${fieldName}-`+ciudadano.curp;
    const { data, error } = await supabase.storage.from("fotos_estructura").upload(filePath, file, { upsert: true });

    if (error) {
      console.error("Error subiendo imagen:", error);
      return;
    }

    const { data: urlData } = supabase.storage.from("fotos_estructura").getPublicUrl(filePath);
    setCiudadano((prev) => ({ ...prev, [fieldName]: urlData.publicUrl }));
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ficha del Ciudadano</h1>

      {/* Imágenes con opción de carga flex flex-nowrap*/}
      <div className="flex flex-wrap justify md:justify-start mb-4">
        <div>
          <img src={ciudadano.url_foto_perfil} alt="Perfil" className="w-auto h-64 object-cover rounded-lg m-auto" />
          <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_perfil")} class="block w-full text-sm text-gray-500
        file:me-4 file:py-2 file:px-4
        file:rounded-lg file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-600 file:text-white
        hover:file:bg-blue-700
        file:disabled:opacity-50 file:disabled:pointer-events-none
        dark:text-neutral-500
        dark:file:bg-blue-500
        dark:hover:file:bg-blue-400 mt-6"/>
        </div>
        <div className="mx-16"></div>
        <div>
          <img src={ciudadano.url_foto_ine1} alt="INE Frente" className="w-auto h-64 object-cover rounded-lg m-auto" />
          <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_ine1")} class="block w-full text-sm text-gray-500
        file:me-4 file:py-2 file:px-4
        file:rounded-lg file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-600 file:text-white
        hover:file:bg-blue-700
        file:disabled:opacity-50 file:disabled:pointer-events-none
        dark:text-neutral-500
        dark:file:bg-blue-500
        dark:hover:file:bg-blue-400 mt-6" />
       
       
        </div>
        <div className="mx-16"></div>
        <div>
          <img src={ciudadano.url_foto_ine2} alt="INE Reverso" className="w-auto h-64 object-cover rounded-lg m-auto" />
          <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_ine2")} class="block w-full text-sm text-gray-500
        file:me-4 file:py-2 file:px-4
        file:rounded-lg file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-600 file:text-white
        hover:file:bg-blue-700
        file:disabled:opacity-50 file:disabled:pointer-events-none
        dark:text-neutral-500
        dark:file:bg-blue-500
        dark:hover:file:bg-blue-400 mt-6" />
        </div>
      </div>

      {/* Formulario en dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label>
          Distrito Federal:
          <input
            type="text"
            value={ciudadano.dtto_fed}
            onChange={(e) => setCiudadano({ ...ciudadano, dtto_fed: e.target.value})}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Distrito Local:
          <input
            type="text"
            value={ciudadano.dtto_loc}
            onChange={(e) => setCiudadano({ ...ciudadano, dtto_loc: e.target.value })}
            className="border p-2 w-full"
            required
          />
        </label>


        <label>
          Poligono:
          <input
            type="text"
            value={ciudadano.poligono}
            onChange={(e) => setCiudadano({ ...ciudadano, poligono: e.target.value})}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Sección:
          <input
            type="text"
            value={ciudadano.seccion}
            onChange={(e) => setCiudadano({ ...ciudadano, seccion: e.target.value })}
            className="border p-2 w-full"
            required
          />
        </label>
        
        <label>
          Area:
          <input
            type="text"
            value={ciudadano.area_adscripcion}
            onChange={(e) => setCiudadano({ ...ciudadano, area_adscripcion: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>
        <label>
          Dependencia:
          <input
            type="text"
            value={ciudadano.dependencia}
            onChange={(e) => setCiudadano({ ...ciudadano, dependencia: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Nombre:
          <input
            type="text"
            value={ciudadano.nombre}
            onChange={(e) => setCiudadano({ ...ciudadano, nombre: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>
        <label>
          Apellido Paterno:
          <input
            type="text"
            value={ciudadano.a_paterno}
            onChange={(e) => setCiudadano({ ...ciudadano, a_paterno: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>
        <label>
          Apellido Materno:
          <input
            type="text"
            value={ciudadano.a_materno}
            onChange={(e) => setCiudadano({ ...ciudadano, a_materno: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>
        <label>
          CURP:
          <input
            type="text"
            value={ciudadano.curp}
            maxLength="18"
            onChange={(e) => setCiudadano({ ...ciudadano, curp: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Usuario:
          <input
            type="text"
            value={ciudadano.usuario}
            maxLength="18"
            onChange={(e) => setCiudadano({ ...ciudadano, usuario: e.target.value })}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Contraseña:
          <input
            type="text"
            value={ciudadano.password}
            maxLength="18"
            onChange={(e) => setCiudadano({ ...ciudadano, password: e.target.value})}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Ingreso a la estructura:
          <input
            type="date"
            value={ciudadano.ingreso_estructura}
            onChange={(e) => setCiudadano({ ...ciudadano, ingreso_estructura: e.target.value })}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Observaciones:
          <input
            type="text"
            value={ciudadano.observaciones}
            onChange={(e) => setCiudadano({ ...ciudadano, observaciones: e.target.value.toUpperCase() })}
            className="border p-2 w-full"
            required
          />
        </label>

        <label>
          Teléfono:
          <input
            type="text"
            value={ciudadano.telefono_1}
            maxLength="10"
            onChange={(e) => setCiudadano({ ...ciudadano, telefono_1: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          Teléfono Alterno:
          <input
            type="text"
            value={ciudadano.telefono_2}
            maxLength="10"
            onChange={(e) => setCiudadano({ ...ciudadano, telefono_2: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        
        <label>
          Calle:
          <input
            type="text"
            value={ciudadano.calle}
            onChange={(e) => setCiudadano({ ...ciudadano, calle: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          N° Ext (MZ):
          <input
            type="text"
            value={ciudadano.n_ext_mz}
            onChange={(e) => setCiudadano({ ...ciudadano, n_ext_mz: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          N° Int (LT):
          <input
            type="text"
            value={ciudadano.n_int_lt}
            onChange={(e) => setCiudadano({ ...ciudadano, n_int_lt: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          N° Casa:
          <input
            type="text"
            value={ciudadano.n_casa}
            onChange={(e) => setCiudadano({ ...ciudadano, n_casa: e.target.value })}
            className="border p-2 w-full"
          />
        </label>


        <label>
          Codigo Postal:
          <input
            type="text"
            value={ciudadano.c_p}
            onChange={(e) => setCiudadano({ ...ciudadano, c_p: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          Localidad o Colonia:
          <input
            type="text"
            value={ciudadano.col_loc}
            onChange={(e) => setCiudadano({ ...ciudadano, col_loc: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          INSTAGRAM:
          <input
            type="text"
            value={ciudadano.cuenta_inst}
            onChange={(e) => setCiudadano({ ...ciudadano, cuenta_inst: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <label>
          FACEBOOK:
          <input
            type="text"
            value={ciudadano.cuenta_fb}
            onChange={(e) => setCiudadano({ ...ciudadano, cuenta_fb: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <label>
          X (TWITTER):
          <input
            type="text"
            value={ciudadano.cuenta_x}
            onChange={(e) => setCiudadano({ ...ciudadano, cuenta_x: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
      </div>

      {/* Botón de guardar cambios */}
      <div className="mt-4">
        <button
          onClick={handleSave}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
};

export default FichaCiudadano;