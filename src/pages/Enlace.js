import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapComponent from '../map/MapComponent';
import MapComponent2 from '../map/MapComponent2';

const Enlace = () => {
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

  const handleSubmit = async (time) => {
    if (!reportData[time]) {
      alert('Por favor ingresa un valor');
      return;
    }

    setIsSubmitting(true);
    try {
      // Replace with your actual Supabase table and columns
      //  const promotor = promotores.find(p => p.id === promotorId);
    
    // if (!promotor) {
    //   throw new Error('Promotor no encontrado');
    // }
      const { error } = await supabase
        .from('cortes_s')
        .upsert({
          delegacion: user.seccion,
          [time]: reportData[time],
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
//   const fetchPromotoras = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('ciudadania') // Nombre de la tabla
//         .select('*').eq("seccion",user.seccion).eq("puesto","PROMOTORA-BIENESTAR").order('ubt', { ascending: true });
//         // .eq('seccion', user.seccion); // Consulta todos los campos

//       if (error) throw error;

//       setPromotores(data); // Actualiza el estado con los datos obtenidos
//     } catch (error) {
//       console.error("Error",error.message);
//       setError(error.message);
//     }
//   };

  const fetchCiudadanos = async () => {
    try {
      const { data, error } = await supabase
        .from('servidores') // Nombre de la tabla
        .select('*').eq("delegacion",user.seccion);
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
    // fetchPromotoras();
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
      <h1 className="border p-2">Bienvenido {user.nombre}</h1>
      <p className="border p-2"><strong>Polígono:</strong> {user.poligono}</p>
      <p className="border p-2"><strong>Delegación:</strong> {user.seccion}</p>
      <p className="border p-2"><strong>Puesto:</strong> {user.puesto}</p>
      {/* <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p> */}


      <div className="border p-2">
          <div className="flex gap-2">
            <h1>12:00 HRS</h1>
            <input
              type="number"
              value={reportData[['twelve'] || '']}
              onChange={(e) => handleInputChange( 'twelve', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit('twelve')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </div>
        
        {/* 15:00 HRS */}
        <div className="border p-2">
          <div className="flex gap-2">
            <h1>15:00 HRS</h1>
            <input
              type="number"
              value={reportData['fifteen'] || ''}
              onChange={(e) => handleInputChange('fifteen', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit( 'fifteen')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </div>
        
        {/* 18:00 HRS */}
        <div className="border p-2">
          <div className="flex gap-2">
            <h1>18:00 HRS</h1>
            <input
              type="number"
              value={reportData['eighteen'] || ''}
              onChange={(e) => handleInputChange('eighteen', e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-20"
              required
            />
            <button 
              onClick={() => handleSubmit('eighteen')}
              disabled={isSubmitting}
              className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
            </button>
          </div>
        </div>
      <div className='m-4'>
      <button onClick={() => navigate(`/enlace/agregar/${user.usuario}`, {state: { user: user }})} className="bg-purple-500 text-white mx-auto my-auto px-4 py-2 rounded">
        
        Agregar Ciudadano
        </button>
    </div>



     < div className='my-8 mx-2'>
        <h2 ><strong>CIUDADANOS</strong></h2>
      </div>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            {/* <th className="border p-2">Polígono</th> */}
            <th className="border p-2">Delegación</th>
            <th className="border p-2">SP</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">CURP</th>
            {/* <th className="border p-2">Puesto</th> */}
          </tr>
        </thead>
      {ciudadanos.length > 0 ? (
          <tbody>
            {ciudadanos.map((resultado) => (
              <tr key={resultado.id}>
                {/* <td className="border p-2">{resultado.poligono}</td> */}
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.sp}</td>
                <td className="border p-2">{resultado.nombre}</td>
                <td className="border p-2">{resultado.curp}</td>
                {/* <td className="border p-2">{resultado.puesto}</td> */}
                
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table>
    </div>
  );
};

export default Enlace;
