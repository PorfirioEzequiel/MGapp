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
    const CP_REGEX = /^[0-9]{5}$/;

    // Estado inicial para 5 ciudadanos
    const initialCiudadanoState = Array(5).fill({
        nombre: "",
        delegacion: user.seccion,
        curp: "",
        seccion: "",
        direccion: "",	
        cp: "",
        sp: "",
        telefono: "",
    });

    const [spNombre, setSpNombre] = useState("");
    const [ciudadanos, setCiudadanos] = useState(initialCiudadanoState);
    const [fieldErrors, setFieldErrors] = useState(Array(5).fill({}));

    const validateFields = () => {
        let isValid = true;
        const newErrors = ciudadanos.map((ciudadano, index) => {
            const errors = {};
            
            if (!ciudadano.nombre) {
                errors.nombre = "Nombre es requerido";
                isValid = false;
            }
            
            if (!ciudadano.curp) {
                errors.curp = "CURP es requerido";
                isValid = false;
            } else if (!CURP_REGEX.test(ciudadano.curp.trim().toUpperCase())) {
                errors.curp = "CURP no válido";
                isValid = false;
            }
            
            if (ciudadano.telefono && !PHONE_REGEX.test(ciudadano.telefono)) {
                errors.telefono = "Teléfono debe tener 10 dígitos";
                isValid = false;
            }
            
            if (ciudadano.cp && !CP_REGEX.test(ciudadano.cp)) {
                errors.cp = "Código postal debe tener 5 dígitos";
                isValid = false;
            }
            
            if (!ciudadano.seccion) {
                errors.seccion = "Sección es requerida";
                isValid = false;
            }
            
            if (!ciudadano.direccion) {
                errors.direccion = "Dirección es requerida";
                isValid = false;
            }

            return errors;
        });

        setFieldErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!spNombre) {
            setError("El nombre del SP es requerido");
            setLoading(false);
            return;
        }

        if (!validateFields()) {
            setLoading(false);
            return;
        }

        try {
            // Preparar datos para insertar
            const ciudadanosToInsert = ciudadanos.map(ciudadano => ({
                ...ciudadano,
                sp: spNombre,
                curp: ciudadano.curp.trim().toUpperCase(),
                delegacion: user.seccion
            })).filter(ciudadano => ciudadano.nombre && ciudadano.curp); // Filtrar solo los con datos

            if (ciudadanosToInsert.length === 0) {
                setError("Debe ingresar al menos un ciudadano");
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('servidores').insert(ciudadanosToInsert);
            
            if (error) {
                setError(error.code === '23505' 
                    ? "Uno o más CURP ya están registrados" 
                    : `Error al guardar: ${error.message}`);
                return;
            }

            alert(`${ciudadanosToInsert.length} ciudadano(s) agregado(s) correctamente`);
            navigate(`/enlace/${user.usuario}`, { state: { user } });

        } catch (error) {
            console.error("Error inesperado:", error);
            setError("Ocurrió un error al guardar los datos");
        } finally {
            setLoading(false);
        }
    };

    const handleCiudadanoChange = (index, e) => {
        const { name, value } = e.target;
        const newCiudadanos = [...ciudadanos];
        newCiudadanos[index] = {
            ...newCiudadanos[index],
            [name]: value.toUpperCase()
        };
        setCiudadanos(newCiudadanos);
        
        // Clear field error when user types
        if (fieldErrors[index][name]) {
            const newErrors = [...fieldErrors];
            newErrors[index] = { ...newErrors[index], [name]: undefined };
            setFieldErrors(newErrors);
        }
    };

    return (
        <div className="p-4 mx-auto max-w-4xl">
            <h1 className="text-xl font-bold mb-4">Agregar Ciudadanos del SP</h1>
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="bg-gray-100 p-4 mb-4 rounded">
                <p><strong>Delegación:</strong> {user.seccion}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="mb-6">
                    <label className="block mb-2 font-medium">Nombre del SP:</label>
                    <input
                        type="text"
                        value={spNombre}
                        onChange={(e) => setSpNombre(e.target.value.toUpperCase())}
                        className="border p-2 w-full rounded"
                        placeholder="NOMBRE DEL SERVIDOR PÚBLICO"
                        required
                    />
                </div>

                <div className="space-y-8">
                    {ciudadanos.map((ciudadano, index) => (
                        <fieldset key={index} className="border p-4 rounded">
                            <legend className="px-2 font-medium">Ciudadano {index + 1}</legend>
                            
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div className="col-span-5"> 
                                    <label className="block mb-1 font-medium">NOMBRE:</label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={ciudadano.nombre}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                        required
                                    />
                                    {fieldErrors[index]?.nombre && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].nombre}</p>
                                    )}
                                </div>
                                
                                <div>
                                    <label className="block mb-1 font-medium">SECCIÓN:</label>
                                    <input
                                        type="text"
                                        name="seccion"
                                        value={ciudadano.seccion}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                        required
                                    />
                                    {fieldErrors[index]?.seccion && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].seccion}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                                <div className="col-span-4"> 
                                    <label className="block mb-1 font-medium">CURP:</label>
                                    <input
                                        type="text"
                                        name="curp"
                                        value={ciudadano.curp}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                        required
                                    />
                                    {fieldErrors[index]?.curp && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].curp}</p>
                                    )}
                                </div>
                                
                                <div className="col-span-2">
                                    <label className="block mb-1 font-medium">TELÉFONO:</label>
                                    <input
                                        type="text"
                                        name="telefono"
                                        value={ciudadano.telefono}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                    />
                                    {fieldErrors[index]?.telefono && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].telefono}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                                <div className="col-span-4"> 
                                    <label className="block mb-1 font-medium">DIRECCIÓN:</label>
                                    <input
                                        type="text"
                                        name="direccion"
                                        value={ciudadano.direccion}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                        required
                                    />
                                    {fieldErrors[index]?.direccion && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].direccion}</p>
                                    )}
                                </div>
                                
                                <div className="col-span-2">
                                    <label className="block mb-1 font-medium">CÓDIGO POSTAL:</label>
                                    <input
                                        type="text"
                                        name="cp"
                                        value={ciudadano.cp}
                                        onChange={(e) => handleCiudadanoChange(index, e)}
                                        className="border p-2 w-full rounded"
                                    />
                                    {fieldErrors[index]?.cp && (
                                        <p className="text-red-500 text-sm">{fieldErrors[index].cp}</p>
                                    )}
                                </div>
                            </div>
                        </fieldset>
                    ))}
                </div>

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
                        {loading ? 'Guardando...' : 'Guardar Todos'}
                    </button>
                </div>
            </form>
        </div>
    );
}