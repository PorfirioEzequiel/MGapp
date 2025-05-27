import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabase/client";

const FichaCiudadanoEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ciudadano, setCiudadano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ubts, setUbts] = useState([]);
  const [error, setError] = useState(null);
  const puestosc=["MOVILIZADOR", "INVITADO"]
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

  // Load section data when ciudadano changes
  useEffect(() => {
    const loadSectionData = async () => {
      if (!ciudadano?.seccion) return;

      setLoading(true);
      try {
        // Load section info
        const { data: sectionData, error: sectionError } = await supabase
          .from('ubt_catalogo')
          .select('*')
          .eq('seccion', ciudadano.seccion)
          .limit(1);

        if (sectionError) throw sectionError;

        // Load UBTs for this section
        const { data: ubtData, error: ubtError } = await supabase
          .from('ubt_catalogo')
          .select('ubt')
          .eq('seccion', ciudadano.seccion);

        if (ubtError) throw ubtError;

        setUbts(ubtData.map(item => item.ubt));
      } catch (error) {
        console.error('Error loading section data:', error);
        setError('Error al cargar datos de la sección');
      } finally {
        setLoading(false);
      }
    };

    if (ciudadano) {
      loadSectionData();
    }
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
  } catch (error) {
    console.error("Error actualizando ciudadano:", error);
    setError("Error al guardar los cambios");
  } finally {
    setLoading(false);
  }
}

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCiudadano(prev => ({
      ...prev,
      [name]: name === 'curp' || name === 'nombre' || name === 'a_paterno' || name === 'a_materno' 
        ? value.toUpperCase() 
        : value
    }));
  };

  if (loading) return <p>Cargando...</p>;
  if (!ciudadano) return <p>No se encontró el ciudadano</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ficha del Ciudadano</h1>
      
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UBT Field - show select if UBTs available, otherwise text input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">UBT:</label>
          {ubts.length > 0 ? (
            <select
              name="ubt"
              value={ciudadano.ubt || ''}
              onChange={handleChange}
              className="border border-gray-300 rounded-md p-2 w-full"
              required
            >
              <option value="">Seleccionar UBT</option>
              {ubts.map((ubt, index) => (
                <option key={index} value={ubt}>{ubt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              name="ubt"
              value={ciudadano.ubt || ''}
              onChange={handleChange}
              className="border p-2 w-full"
              required
            />
          )}
        </div>

        {/* <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">PUESTO:</label>
          <input
            type="text"
            name="puesto"
            value={ciudadano.puesto || ''}
            onChange={handleChange}
            className="border p-2 w-full"
            required
          />
        </div> */}

        <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Puesto:</label>
                        <select
                            name="puesto"
                            value={ciudadano.puesto || ''}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        >
                            <option value="">Seleccionar puesto</option>
                            {puestosc.map((puesto, index) => (
                                <option key={index} value={puesto}>{puesto}</option>
                            ))}
                        </select>
                    </div>

        {/* Other fields */}
        {[
          { name: 'nombre', label: 'Nombre' },
          { name: 'a_paterno', label: 'Apellido Paterno' },
          { name: 'a_materno', label: 'Apellido Materno' },
          { name: 'curp', label: 'CURP', maxLength: 18 },
          { name: 'movilizador', label: 'Movilizador' },
          { name: 'telefono_1', label: 'Teléfono', maxLength: 10 },
          { name: 'calle', label: 'Calle' },
          { name: 'n_ext_mz', label: 'N° Ext (MZ)' },
          { name: 'n_int_lt', label: 'N° Int (LT)' },
          { name: 'n_casa', label: 'N° Casa' },
          { name: 'c_p', label: 'Código Postal' },
          { name: 'col_loc', label: 'Localidad o Colonia' },
        ].map((field) => (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}:
            </label>
            <input
              type="text"
              name={field.name}
              value={ciudadano[field.name] || ''}
              onChange={handleChange}
              maxLength={field.maxLength}
              className="border border-gray-300 rounded-md p-2 w-full"
              required={field.required}
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
          {loading ? 'Guardando...' : 'Guardar Cambios'}
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