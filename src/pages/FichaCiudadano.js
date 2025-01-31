// import React from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from '../supabase/client';

const FichaCiudadano = ()=>{
    const { id } = useParams();
    const navigate = useNavigate();
    const [ciudadano, setCiudadano] = useState(null);
    const [loading, setLoading] = useState(true);
    const [opciones, setOpciones] = useState({ poligonos: [], secciones: [], ubts:[],puestos: [] });

    useEffect(() => {
        const cargarOpciones = async () => {
          try {
            const { data, error } = await supabase
              .from('ciudadania') // Reemplaza con el nombre de tu tabla
              .select('*');
    
            if (error) throw error;
    
            // Extraer valores únicos para los selectores
            const poligonos = [...new Set(data.map((item) => item.poligono))];
            const secciones = [...new Set(data.map((item) => item.seccion))];
            const ubts = [...new Set(data.map((item) => item.ubt))];
            const puestos = [...new Set(data.map((item) => item.puesto))];
            setOpciones({ poligonos, secciones,ubts, puestos });
          } catch (err) {
            console.error('Error al cargar opciones:', err.message);
          }
        };
    
        cargarOpciones();
      }, []);

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
            nombre: ciudadano.nombre,
            a_paterno: ciudadano.a_paterno,
            a_materno: ciudadano.a_materno,
            curp: ciudadano.curp,
            telefono_1: ciudadano.telefono_1,
          })
          .eq("id", id);
    
        if (error) {
          console.error("Error actualizando ciudadano:", error);
        } else {
          alert("Datos actualizados correctamente");
        }
      }
    
      if (loading) return <p>Cargando...</p>;
    return(
        <div>
        <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ficha del Ciudadano</h1>
      <div className="grid gap-4">

      <label>
          Polígono:
          <select 
          value={ciudadano.poligono} 
          onChange={(e) => setCiudadano({ ...ciudadano, poligono: e.target.value})}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.poligonos.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sección:
          <select 
          value={ciudadano.seccion} 
          onChange={(e) => setCiudadano({ ...ciudadano, seccion: e.target.value})}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.secciones.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>

        <label>
          UBT:
          <select 
          value={ciudadano.ubt} 
          onChange={(e) => setCiudadano({ ...ciudadano, ubt: e.target.value})}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.ubts.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>

        <label>
          Puesto:
          <select 
          value={ciudadano.puesto} 
          onChange={(e) => setCiudadano({ ...ciudadano, puesto: e.target.value})}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.puestos.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nombre:
          <input
            type="text"
            value={ciudadano.nombre}
            onChange={(e) => setCiudadano({ ...ciudadano, nombre: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <label>
          Apellido Paterno:
          <input
            type="text"
            value={ciudadano.a_paterno}
            onChange={(e) => setCiudadano({ ...ciudadano, a_paterno: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <label>
          Apellido Materno:
          <input
            type="text"
            value={ciudadano.a_materno}
            onChange={(e) => setCiudadano({ ...ciudadano, a_materno: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <label>
          CURP:
          <input
            type="text"
            value={ciudadano.curp}
            onChange={(e) => setCiudadano({ ...ciudadano, curp: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          Usuario:
          <input
            type="text"
            value={ciudadano.usuario}
            onChange={(e) => setCiudadano({ ...ciudadano, usuario: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          Contraseña:
          <input
            type="text"
            value={ciudadano.password}
            onChange={(e) => setCiudadano({ ...ciudadano, password: e.target.value })}
            className="border p-2 w-full"
          />
        </label>

        <label>
          Teléfono:
          <input
            type="text"
            value={ciudadano.telefono_1}
            onChange={(e) => setCiudadano({ ...ciudadano, telefono_1: e.target.value })}
            className="border p-2 w-full"
          />
        </label>
        <button
          onClick={handleSave}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Guardar Cambios
        </button>
        {/* <button
          onClick={() => navigate("/admin/:usuario")}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Volver
        </button> */}
      </div>
    </div>
    
    </div>
);
};

export default FichaCiudadano;

