import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
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
    <div>
      <h1>Perfil de {usuario}</h1>
      <h1>Bienvenido {user.nombre} {user.a_paterno} {user.a_materno}</h1>
      <p><strong>Polígono:</strong> {user.poligono}</p>
      <p><strong>Sección:</strong> {user.seccion}</p>
      <p><strong>Puesto:</strong> {user.puesto}</p>
      <p><strong>Lista nominal:</strong> {section.lista_nominal}</p>
      <h2>Promotor@s del Bienestar:</h2>
      {promotores.length > 0 ? (

          <ul>
            <h1>{promotores.length}</h1>
            {promotores.map((resultado) => (
              <li key={resultado.id}>
                {resultado.poligono} - {resultado.seccion} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno}
                
              </li>
            ))}
          </ul>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      {/* <MapComponent mapa={section.geometry}/> */}
      <MapComponent2/>
    </div>
  );
};

export default Perfil;
