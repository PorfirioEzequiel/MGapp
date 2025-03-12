import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapComponent from '../map/MapComponent';
import MapComponent2 from '../map/MapComponent2';

const Coordinador = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();
  const navigate = useNavigate();
  const [section, setSeccion] = useState({});
  const [error, setError] = useState(null);
  const [error1, setError1] = useState(null);
  const [error2, setError2] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const [seccionales, setSeccionales] = useState([]);


  const [poligono, setPoligono] = useState('');
  const [seccion, setSection] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [opciones, setOpciones] = useState({ secciones: []});
  // const navigate = useNavigate();

  // Cargar datos iniciales para los selectores
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const { data, error } = await supabase
          .from('ciudadania') // Reemplaza con el nombre de tu tabla
          .select('seccion').eq('poligono',user.poligono);

        if (error) throw error;

        // Extraer valores únicos para los selectores
        
        const secciones = [...new Set(data.map((item) => item.seccion))];
        
        const puestos1 = [...new Set(data.map((item) => item.puesto))];
        // console.log(puestos1);
        setOpciones({ secciones});
      } catch (err) {
        console.error('Error al cargar opciones:', err.message);
      }
    };

    cargarOpciones();
  }, []);
  
  // Manejar búsqueda en Supabase
  const manejarFiltro = async () => {
    try {
      // Construir filtros dinámicos
      let query = supabase.from('ciudadania').select('*').eq('poligono',user.poligono).eq('puesto',"PROMOTORA-BIENESTAR").eq('status',"ACTIVO").order('ubt', { ascending: true });

      if (seccion) query = query.eq('seccion', seccion);
      if (nombre) query = query.ilike('nombre', `%${nombre}%`);

      const { data, error } = await query;

      if (error) throw error;

      setResultados(data);
    } catch (err) {
      console.error('Error al filtrar:', err.message);
    }
  };

  const fetchSecciones = async () => {
    try {
      const { data, error } = await supabase
        .from('secciones') // Nombre de la tabla
        .select('*').eq("pologono",user.poligono).single();
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
        .select('*').eq('poligono',user.poligono).eq('puesto',"PROMOTORA-BIENESTAR");
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error1) throw error;

      setPromotores(data); // Actualiza el estado con los datos obtenidos
    } catch (error1) {
      console.error("Error supabase",error1.message);
      setError1(error1.message);
    }
  };

  const fetchSeccionales = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq('poligono',user.poligono).eq('puesto',"SECCIONAL").eq('status',"ACTIVO");
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error2) throw error;

      setSeccionales(data); // Actualiza el estado con los datos obtenidos
    } catch (error2) {
      console.error("Error supabase",error2.message);
      setError2(error2.message);
    }
  };
    useEffect(() => {
    fetchSecciones(); // Llama a la función al montar el componente
    fetchPromotoras();
    fetchSeccionales();
  }, []);

  
  
  
  if (error1) {
    return <p>Error d: {error}</p>;
  }

  if (!user) {
    return <p>Error: Usuario no encontrado</p>;
  }
  
  return (
    <div className='mx-auto'>
      {/* <h1>Perfil de {usuario}</h1> */}
      <h1 className="border p-2">Bienvenido {user.nombre} {user.a_paterno} {user.a_materno}</h1>
      <p className="border p-2"><strong>Polígono:</strong> {user.poligono}</p>
      {/* <p className="border p-2"><strong>Sección:</strong> {user.seccion}</p> */}
      <p className="border p-2"><strong>Puesto:</strong> {user.puesto}</p>
      {/* <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p> */}

      <p className="border p-2"><strong>Seccionales:</strong> {seccionales.length}</p>
      <p className="border p-2"><strong>Promotor@s del Bienestar:</strong> {promotores.length}</p>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Verificar</th>
          </tr>
        </thead>
      {seccionales.length > 0 ? (
          <tbody>
            {seccionales.map((resultado) => (
              <tr key={resultado.id}>
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                <td className="border p-2">{resultado.puesto}</td>
                <td className="border p-2">
                <button onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    VERIFICAR
                </button>
                </td>
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table>
      <label>
          Sección:
          <select 
          value={seccion} 
          onChange={(e) => setSection(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todas</option>
            {opciones.secciones.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </label>

        {/* Input para Nombre */}
        <label>
          Nombre:
          <input
            type="text"
            placeholder="Buscar por nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border p-2 w-full"
          />
        </label>
        <button className="bg-blue-500 text-white mx-auto my-auto px-4 py-2 rounded"
         onClick={manejarFiltro}>Buscar</button>

<div className="p-4">
        <h2>Resultados:</h2>

        <h3>{resultados.length}    </h3>
        <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            {/* <th className="border p-2">Eliminar</th> */}
            <th className="border p-2">Verificar</th>
          </tr>
        </thead>
        {resultados.length > 0 ? (
            // <h1>{resultados.length}</h1>
          <tbody>
            {/* <h1>{resultados.length}</h1> */}
            {resultados.map((resultado) => (
              <tr key={resultado.id}>
                {/* {resultado.poligono} - {resultado.seccion} -{resultado.ubt} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno} */}
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.ubt}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                <td className="border p-2">{resultado.puesto}</td>
                
                <td className="border p-2">
                <button onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    VERIFICAR
                </button>
                </td>
                {/* {resultado.status} */}
              </tr>
            ))}
          </tbody>
          
        ) : (
          <p>No se encontraron resultados.</p>
        )}
        </table>
      </div>





      <p className="border p-2"><strong>Promotor@s del Bienestar:</strong> {promotores.length}</p>
      



      {/* <MapComponent mapa={section.geometry}/> */}
      <MapComponent2 mapa={user.poligono}/>
    </div>
  );
};

export default Coordinador;