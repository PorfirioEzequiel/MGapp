import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapComponent from '../map/MapComponent';
import MapComponent2 from '../map/MapComponent2';

const Perfil = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();

  // const [section, setSeccion] = useState({});
  const [error, setError] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const [ciudadanos, setCiudadanos] = useState([]);
  const navigate = useNavigate();
  const [reportData, setReportData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (promotorId, time, value) => {
    setReportData(prev => ({
      ...prev,
      [promotorId]: {
        ...prev[promotorId],
        [time]: value
      }
    }));
  };

  const handleSubmit = async (promotorId, time) => {
    if (!reportData[promotorId]?.[time]) {
      alert('Por favor ingresa un valor');
      return;
    }

    setIsSubmitting(true);
    try {
      // Replace with your actual Supabase table and columns
       const promotor = promotores.find(p => p.id === promotorId);
    
    if (!promotor) {
      throw new Error('Promotor no encontrado');
    }
      const { error } = await supabase
        .from('cortes')
        .upsert({
          promotor_id: promotorId,
          poligono: promotor.poligono,
          seccion: promotor.seccion,
          ubt: promotor.ubt,
          pb: `${promotor.nombre} ${promotor.a_paterno}`,
          [time]: reportData[promotorId][time],
          // updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      alert('Reporte enviado exitosamente');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Error al enviar el reporte');
    } finally {
      setIsSubmitting(false);
    }
  };

  // const fetchSecciones = async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('secciones') // Nombre de la tabla
  //       .select('*').eq("seccion",user.seccion).single();
  //       // .eq('seccion', user.seccion); // Consulta todos los campos

  //     if (error) throw error;

  //     setSeccion(data); // Actualiza el estado con los datos obtenidos
  //   } catch (error) {
  //     console.error("Error",error.message);
  //     setError(error.message);
  //   }
  // };
  const fetchPromotoras = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq("seccion",user.seccion).eq("puesto","PROMOTORA-BIENESTAR").eq("status","ACTIVO").order('ubt', { ascending: true });
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error) throw error;

      setPromotores(data); // Actualiza el estado con los datos obtenidos
    } catch (error) {
      console.error("Error",error.message);
      setError(error.message);
    }
  };

  const fetchCiudadanos = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq("seccion",user.seccion).or(`puesto.eq.MOVILIZADOR,puesto.eq.INVITADO`).order('puesto', { ascending: false }).order('ubt', { ascending: true });
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error) throw error;

      setCiudadanos(data); // Actualiza el estado con los datos obtenidos
    } catch (error) {
      console.error("Error",error.message);
      setError(error.message);
    }
  };

    useEffect(() => {
    // fetchSecciones(); // Llama a la función al montar el componente
    fetchCiudadanos();
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
      
      {/* <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p> */}
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
            <th className="border p-2">12:00 HRS</th>
            <th className="border p-2">15:00 HRS</th>
            <th className="border p-2">18:00 HRS</th>
            
          </tr>
        </thead>
      {promotores.length > 0 ? (
          <tbody>
            {promotores.map((promotor) => (
              <tr key={promotor.id}>
                <td className="border p-2">{promotor.poligono}</td>
                <td className="border p-2">{promotor.seccion}</td>
                <td className="border p-2">{promotor.ubt}</td>
                <td className="border p-2">{promotor.nombre} {promotor.a_paterno} {promotor.a_materno}</td>
                <td className="border p-2">{promotor.puesto}</td>
                {/* 12:00 HRS */}
        <td className="border p-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={reportData[promotor.id]?.['twelve'] || ''}
              onChange={(e) => handleInputChange(promotor.id, 'twelve', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit(promotor.id, 'twelve')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </td>
        
        {/* 15:00 HRS */}
        <td className="border p-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={reportData[promotor.id]?.['fifteen'] || ''}
              onChange={(e) => handleInputChange(promotor.id, 'fifteen', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit(promotor.id, 'fifteen')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </td>
        
        {/* 18:00 HRS */}
        <td className="border p-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={reportData[promotor.id]?.['eighteen'] || ''}
              onChange={(e) => handleInputChange(promotor.id, 'eighteen', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit(promotor.id, 'eighteen')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </td>

                {/* <td className="border p-2"><input></input><button>Enviar</button></td>
                <td className="border p-2"><input></input><button>Enviar</button></td> */}
                
                {/* {resultado.poligono} - {resultado.seccion} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno} */}
                
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table>
     < div className='my-8 mx-2'>
        <h2 ><strong>CIUDADANOS</strong></h2>
      </div>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Movilizador</th>
            <th className="border p-2">Editar</th>
          </tr>
        </thead>
      {ciudadanos.length > 0 ? (
          <tbody>
            {ciudadanos.map((resultado) => (
              <tr key={resultado.id}>
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.ubt}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                <td className="border p-2">{resultado.puesto}</td>
                <td className="border p-2">{resultado.movilizador}</td>
                <td><button onClick={() => navigate(`/ciudadanoE/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    EDITAR
                </button></td>
                {/* {resultado.poligono} - {resultado.seccion} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno} */}
                
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table>
      {/* <MapComponent mapa={section.geometry}/> */}
      {/* <MapComponent2 mapa={user.poligono}/> */}
    </div>
  );
};

export default Perfil;
