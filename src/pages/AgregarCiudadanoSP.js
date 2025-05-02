import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from '../supabase/client';

export default function AgregarCiudadanoSP() {
    const { state } = useLocation();
    const { user } = state || {};
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const CURP_REGEX = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;
    const PHONE_REGEX = /^[0-9]{10}$/;

    const initialCiudadanoState = {
        dtto_fed: user.dtto_fed,
        dtto_loc: user.dtto_loc,
        municipio: 82, // Hardcoded as in original
        nombre_municipio: user.nombre_municipio,	
        poligono: user.poligono,
        seccion: user.seccion,
        ubt: "",
        area_adscripcion: "",	
        dependencia: "",	
        puesto: "CIUDADANO",	
        id_puesto: 0,	
        tipo: "",	
        ingreso_estructura: new Date().toISOString().split('T')[0], // Current date
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
        c_p: 0,
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

    const [nuevoCiudadano, setNuevoCiudadano] = useState(initialCiudadanoState);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate required fields
        if (!nuevoCiudadano.nombre || !nuevoCiudadano.a_paterno || !nuevoCiudadano.curp) {
            setError("Por favor complete todos los campos obligatorios");
            setLoading(false);
            return;
        }

        const curp = nuevoCiudadano.curp.trim().toUpperCase();
        
        if (!CURP_REGEX.test(curp)) {
            setError("El CURP ingresado no es válido. Verifique el formato.");
            setLoading(false);
            return;
        }

        if (nuevoCiudadano.telefono_1 && !PHONE_REGEX.test(nuevoCiudadano.telefono_1)) {
            setError("El teléfono debe tener 10 dígitos");
            setLoading(false);
            return;
        }

        try {
            const ciudadanoToInsert = {
                ...nuevoCiudadano,
                usuario: curp // Set username as CURP
            };

            const { error } = await supabase.from('ciudadania').insert([ciudadanoToInsert]);
            
            if (error) {
                if (error.code === '23505') {
                    setError("Este CURP ya está registrado");
                } else {
                    setError(`Error al guardar: ${error.message}`);
                }
                return;
            }

            alert("Ciudadano agregado correctamente");
            // Reset form while preserving location state values
            setNuevoCiudadano({
                ...initialCiudadanoState,
                dtto_fed: user.dtto_fed,
                dtto_loc: user.dtto_loc,
                municipio: 82,
                nombre_municipio: user.nombre_municipio,
                poligono: user.poligono,
                seccion: user.seccion
            });

        } catch (error) {
            console.error("Error inesperado:", error);
            setError("Ocurrió un error al guardar los datos");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNuevoCiudadano(prev => ({
            ...prev,
            [name]: typeof prev[name] === 'number' ? Number(value) : value.toUpperCase()
        }));
    };

    return (
        <div className="p-4 mx-auto max-w-2xl">
            <h1 className="text-xl font-bold mb-4">Agregar Ciudadano</h1>
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="bg-gray-100 p-4 mb-4 rounded">
                <p><strong>Delegación:</strong> {user.seccion}</p>
                <p><strong>Distrito Federal:</strong> {user.dtto_fed}</p>
                <p><strong>Distrito Local:</strong> {user.dtto_loc}</p>
                <p><strong>Polígono:</strong> {user.poligono}</p>
                <p><strong>Municipio:</strong> {user.nombre_municipio}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-1 font-medium">SP:</label>
                    <input
                        type="text"
                        name="observaciones"
                        placeholder="NOMBRE DEL SP"
                        value={nuevoCiudadano.observaciones}
                        onChange={handleInputChange}
                        className="border p-2 w-full rounded"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block mb-1 font-medium">Nombre:</label>
                        <input
                            type="text"
                            name="nombre"
                            value={nuevoCiudadano.nombre}
                            onChange={handleInputChange}
                            className="border p-2 w-full rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-medium">Apellido Paterno:</label>
                        <input
                            type="text"
                            name="a_paterno"
                            value={nuevoCiudadano.a_paterno}
                            onChange={handleInputChange}
                            className="border p-2 w-full rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-medium">Apellido Materno:</label>
                        <input
                            type="text"
                            name="a_materno"
                            value={nuevoCiudadano.a_materno}
                            onChange={handleInputChange}
                            className="border p-2 w-full rounded"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block mb-1 font-medium">CURP:</label>
                    <input
                        type="text"
                        name="curp"
                        placeholder="CURP"
                        value={nuevoCiudadano.curp}
                        onChange={handleInputChange}
                        className="border p-2 w-full rounded"
                        required
                    />
                </div>

                {/* Add other fields similarly */}

                <div className="flex justify-end space-x-4 mt-6">
                    <button
                        type="button"
                        onClick={() => navigate(`/enlace/${user.usuario}`, {state: { user }})}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        disabled={loading}
                    >
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
}