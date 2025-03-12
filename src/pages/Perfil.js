import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapComponent from '../map/MapComponent';
import MapComponent2 from '../map/MapComponent2';

const Perfil = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();

  const [section, setSeccion] = useState({});
  const [error, setError] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const navigate = useNavigate();

  const fetchSecciones = async () => {
    try {
      const { data, error } = await supabase
        .from('secciones') // Nombre de la tabla
        .select('*').eq("seccion",user.seccion).single();
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error) throw error;

      setSeccion(data); // Actualiza el estado con los datos obtenidos
    } catch (error) {
      console.error("Error",error.message);
      setError(error.message);
    }
  };
  const fetchPromotoras = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq("seccion",user.seccion).eq("puesto","PROMOTORA-BIENESTAR");
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error) throw error;

      setPromotores(data); // Actualiza el estado con los datos obtenidos
    } catch (error) {
      console.error("Error",error.message);
      setError(error.message);
    }
  };
    useEffect(() => {
    fetchSecciones(); // Llama a la función al montar el componente
    fetchPromotoras();
  }, []);

  
  
  
  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!user) {
    return <p>Error: Usuario no encontrado</p>;
  }
  
  return (
    <div className='mx-auto'>
      {/* <h1>Perfil de {usuario}</h1> */}
      <h1 className="border p-2">Bienvenido {user.nombre} {user.a_paterno} {user.a_materno}</h1>
      <p className="border p-2"><strong>Polígono:</strong> {user.poligono}</p>
      <p className="border p-2"><strong>Sección:</strong> {user.seccion}</p>
      <p className="border p-2"><strong>Puesto:</strong> {user.puesto}</p>
      <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p>
      <p className="border p-2"><strong>Promotor@s del Bienestar:</strong> {promotores.length}</p>
      <button onClick={() => navigate(`/seccional/agregar/${user.usuario}`, {state: { user: user }})} className="bg-green-500 text-white mx-auto my-auto px-4 py-2 rounded">
        
        Agregar Ciudadano
        </button>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
          </tr>
        </thead>
      {promotores.length > 0 ? (
          <tbody>
            {promotores.map((resultado) => (
              <tr key={resultado.id}>
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.ubt}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                <td className="border p-2">{resultado.puesto}</td>
                {/* {resultado.poligono} - {resultado.seccion} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno} */}
                
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table>
      <MapComponent mapa={section.geometry}/>
      {/* <MapComponent2 mapa={user.poligono}/> */}
    </div>
  );
};

export default Perfil;
