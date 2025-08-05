import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from '../supabase/client';

export default function Movilizadores() {

    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [ubts, setUbts] = useState([]);
    const [puestos, setPuestos] = useState([]);
    const [seccion, setSeccion] = useState("");
    const [cantidad, setCantidad] = useState(0);
    const [files, setFiles] = useState([]);


    // Form validation regex
    const CURP_REGEX = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;
    const PHONE_REGEX = /^[0-9]{10}$/;
    const ZIP_CODE_REGEX = /^[0-9]{5}$/;

    const initialFormState = {
        dtto_fed: 0,
        dtto_loc: 0,
        municipio: 82,
        nombre_municipio: '',
        poligono: '',
        seccion: seccion,
        ubt: "",
        area_adscripcion: "",    
        dependencia: "",    
        puesto: "",    
        id_puesto: 0,    
        tipo: "",    
        ingreso_estructura: new Date().toISOString().split('T')[0], // Current date
        movilizador:"",
        observaciones: "",
        usuario: "",    
        password: "",
        nombre: "",
        a_paterno: "",
        a_materno: "",
        curp: "",
        calle: "",
        n_ext_mz: "",    
        n_int_lt: "",
        n_casa: "",
        c_p: null,
        col_loc: "",
        telefono_1: "",
        telefono_2: "",
        cuenta_inst: "",
        cuenta_fb: "",
        cuenta_x: "",
        status: "ACTIVO",
        url_foto_perfil: "",
        url_foto_ine1: "",
        url_foto_ine2: "",
    };

    const [formData, setFormData] = useState(initialFormState);
    const [promotores, setPromotores] = useState([]);

    const fetchPromotoras = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('ciudadania')
                .select('*')
                .eq("seccion", seccion)
                .eq("puesto", "PROMOTORA-BIENESTAR")
                .eq("status", "ACTIVO")
                .order('ubt', { ascending: true });

            if (error) throw error;
            setPromotores(data || []);
        } catch (error) {
            console.error("Error fetching promotoras:", error.message);
            setError(error.message);
        }
    }, [seccion]);

    useEffect(() => {
        fetchPromotoras();
    }, [fetchPromotoras]);
  
    // Load job positions on component mount
    useEffect(() => {
        const loadPositions = async () => {
            try {
                const { data, error } = await supabase
                    .from('puestos')
                    .select('*');
                
                if (error) throw error;
                setPuestos(data.map(item => item.puesto));
            } catch (err) {
                console.error('Error loading positions:', err.message);
                setError('Error al cargar los puestos disponibles');
            }
        };

        loadPositions();
    }, []);

    // Load section data when section changes
    useEffect(() => {
        const loadSectionData = async () => {
            if (!formData.seccion) return;

            setLoading(true);
            try {
                const { data: sectionData, error } = await supabase
                    .from('ubt_catalogo')
                    .select('*')
                    .eq('seccion', formData.seccion)
                    .limit(1);

                if (error) throw error;

                if (sectionData && sectionData.length > 0) {
                    const sectionInfo = sectionData[0];
                    setFormData(prev => ({
                        ...prev,
                        poligono: sectionInfo.poligono,
                        nombre_municipio: sectionInfo.nombre_municipio,
                        dtto_fed: sectionInfo.dtto_fed,
                        dtto_loc: sectionInfo.dtto_loc,
                        municipio: sectionInfo.municipio,
                        puesto: "CIUDADANO"
                    }));

                    // Load UBTs for this section
                    const { data: ubtData, error: ubtError } = await supabase
                        .from('ubt_catalogo')
                        .select('ubt')
                        .eq('seccion', formData.seccion);

                    if (ubtError) throw ubtError;

                    setUbts(ubtData.map(item => item.ubt));
                }
            } catch (error) {
                console.error('Error loading section data:', error);
                setError('Error al cargar datos de la sección');
            } finally {
                setLoading(false);
            }
        };

        loadSectionData();
    }, [formData.seccion]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: typeof prev[name] === 'number' ? Number(value) : value.toUpperCase()
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate required fields
        const requiredFields = ['nombre', 'a_paterno', 'curp', 'calle', 'n_ext_mz', 'telefono_1', 'c_p'];
        const missingFields = requiredFields.filter(field => !formData[field]);

        if (missingFields.length > 0) {
            setError(`Faltan campos obligatorios: ${missingFields.join(', ')}`);
            setLoading(false);
            return;
        }

        // Validate CURP format
        const curp = formData.curp.trim().toUpperCase();
        if (!CURP_REGEX.test(curp)) {
            setError("El CURP ingresado no es válido. Verifique el formato.");
            setLoading(false);
            return;
        }

        // Validate phone number format
        if (formData.telefono_1 && !PHONE_REGEX.test(formData.telefono_1)) {
            setError("El teléfono debe tener 10 dígitos");
            setLoading(false);
            return;
        }

        // Validate ZIP code format
        if (formData.c_p && !ZIP_CODE_REGEX.test(String(formData.c_p))) {
            setError("El código postal debe tener 5 dígitos");
            setLoading(false);
            return;
        }

        try {
            const citizenToInsert = {
                ...formData,
                usuario: curp, // Set username as CURP
                curp: curp // Ensure CURP is in uppercase
            };

            const { error } = await supabase.from('ciudadania').insert([citizenToInsert]);
            
            if (error) {
                if (error.code === '23505') {
                    throw new Error("Este CURP ya está registrado");
                } else {
                    throw new Error(`Error al guardar: ${error.message}`);
                }
            }

            alert("Ciudadano agregado correctamente");
            // Reset form while preserving initial values
            setFormData({
                ...initialFormState,
                seccion: seccion || ''
            });
            setUbts([]);
            // navigate(`/perfil/${user.usuario}`, { state: { user } })

        } catch (error) {
            console.error("Error saving citizen:", error);
            setError(error.message || "Ocurrió un error al guardar los datos");
        } finally {
            setLoading(false);
        }
    };
    const promotorasUBT = formData.ubt 
        ? promotores.filter(pb => pb.ubt === formData.ubt)
        : [];
    // const puestosc=["MOVILIZADOR", "INVITADO"]
    return (
        <div className="p-4 mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold mb-6 text-center">Agregar Movilizador</h1>
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sección:</label>
                        <input
                            type="text"
                            name="seccion"
                            value={formData.seccion}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>

            

            <form onSubmit={handleSubmit} className="space-y-4">
                {ubts.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">UBT:</label>
                        <select
                            name="ubt"
                            value={formData.ubt}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        >
                            <option value="">Seleccionar UBT</option>
                            {ubts.map((ubt, index) => (
                                <option key={index} value={ubt}>{ubt}</option>
                            ))}
                        </select>
                    </div>
                )}
                {formData.ubt && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Promotora Bienestar:</label>
                        <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
                            {promotorasUBT.length > 0 ? (
                                promotorasUBT.map(pb => (
                                    <div key={pb.id}>
                                        {pb.nombre} {pb.a_paterno} {pb.a_materno} - Tel: {pb.telefono_1}
                                    </div>
                                ))
                            ) : (
                                <div className="text-gray-500">No hay promotoras asignadas a esta UBT</div>
                            )}
                        </div>
                    </div>
                )}

                
                                    
                    
                    <div className="mb-6">
        <label className="block mb-2 font-medium">
          Cantidad de personas movilizadas:
        </label>
        <input
          type="number"
        //   min="0"
          value={cantidad}
          onChange={(e) => setCantidad( e.target.value)}
          className="border border-gray-300 rounded-md p-2 w-20"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Subir evidencias fotográficas ({cantidad}):</h2>
        <div className="grid gap-4">
          {[...Array(Number([1]))].map((_, index) => (
            <div key={index} className="border p-4 rounded-lg">
              <label className="block mb-2">Evidencia Fotográfica</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(index, e)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {files[index] && (
                <p className="mt-2 text-sm text-green-600">
                  Archivo seleccionado: {files[index].name}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">


                    

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre:</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Paterno:</label>
                        <input
                            type="text"
                            name="a_paterno"
                            value={formData.a_paterno}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Materno:</label>
                        <input
                            type="text"
                            name="a_materno"
                            value={formData.a_materno}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CURP:</label>
                        <input
                            type="text"
                            name="curp"
                            value={formData.curp}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full uppercase"
                            required
                            maxLength={18}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono:</label>
                        <input
                            type="tel"
                            name="telefono_1"
                            value={formData.telefono_1}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                            maxLength={10}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calle:</label>
                    <input
                        type="text"
                        name="calle"
                        value={formData.calle}
                        onChange={handleInputChange}
                        className="border border-gray-300 rounded-md p-2 w-full"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">N° Ext (MZ):</label>
                        <input
                            type="text"
                            name="n_ext_mz"
                            value={formData.n_ext_mz}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">N° Int (LT):</label>
                        <input
                            type="text"
                            name="n_int_lt"
                            value={formData.n_int_lt}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">N° Casa:</label>
                        <input
                            type="text"
                            name="n_casa"
                            value={formData.n_casa}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Colonia/Localidad:</label>
                        <input
                            type="text"
                            name="col_loc"
                            value={formData.col_loc}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal:</label>
                        <input
                            type="number"
                            name="c_p"
                            value={formData.c_p}
                            onChange={handleInputChange}
                            className="border border-gray-300 rounded-md p-2 w-full"
                            required
                            min="0"
                            max="99999"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                    <button
                        type="button"
                        onClick={() => navigate(`/movilizadore`)}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded transition"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded transition"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Guardando...
                            </span>
                        ) : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
}