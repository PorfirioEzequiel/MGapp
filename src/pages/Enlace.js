// import React, { useEffect, useState } from 'react';
// import { useLocation, useNavigate, useParams } from 'react-router-dom';
// import supabase from '../supabase/client';
// import MapComponent from '../map/MapComponent';
// import MapComponent2 from '../map/MapComponent2';

// const Enlace = () => {
//   const { state } = useLocation();
//   const { user } = state || {};
//   const { usuario } = useParams();

//   // const [section, setSeccion] = useState({});
//   const [error, setError] = useState(null);
//   const [promotores, setPromotores] = useState([]);
//   const [ciudadanos, setCiudadanos] = useState([]);
//   const navigate = useNavigate();

//   const [reportData, setReportData] = useState({});
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const handleInputChange = (promotorId, time, value) => {
//     setReportData(prev => ({
//       ...prev,
//       [promotorId]: {
//         ...prev[promotorId],
//         [time]: value
//       }
//     }));
//   };

//   const handleSubmit = async (time) => {
//     if (!reportData[time]) {
//       alert('Por favor ingresa un valor');
//       return;
//     }

//     setIsSubmitting(true);
//     try {
//       // Replace with your actual Supabase table and columns
//       //  const promotor = promotores.find(p => p.id === promotorId);
    
//     // if (!promotor) {
//     //   throw new Error('Promotor no encontrado');
//     // }
//       const { error } = await supabase
//         .from('cortes_s')
//         .upsert({
//           delegacion: user.seccion,
//           [time]: reportData[time],
//           // updated_at: new Date().toISOString()
//         });

//       if (error) throw error;
      
//       alert('Reporte enviado exitosamente');
//     } catch (error) {
//       console.error('Error submitting report:', error);
//       alert('Error al enviar el reporte');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // const fetchSecciones = async () => {
//   //   try {
//   //     const { data, error } = await supabase
//   //       .from('secciones') // Nombre de la tabla
//   //       .select('*').eq("seccion",user.seccion).single();
//   //       // .eq('seccion', user.seccion); // Consulta todos los campos

//   //     if (error) throw error;

//   //     setSeccion(data); // Actualiza el estado con los datos obtenidos
//   //   } catch (error) {
//   //     console.error("Error",error.message);
//   //     setError(error.message);
//   //   }
//   // };
// //   const fetchPromotoras = async () => {
// //     try {
// //       const { data, error } = await supabase
// //         .from('ciudadania') // Nombre de la tabla
// //         .select('*').eq("seccion",user.seccion).eq("puesto","PROMOTORA-BIENESTAR").order('ubt', { ascending: true });
// //         // .eq('seccion', user.seccion); // Consulta todos los campos

// //       if (error) throw error;

// //       setPromotores(data); // Actualiza el estado con los datos obtenidos
// //     } catch (error) {
// //       console.error("Error",error.message);
// //       setError(error.message);
// //     }
// //   };

//   const fetchCiudadanos = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('servidores') // Nombre de la tabla
//         .select('*').eq("delegacion",user.seccion);
//         // .eq('seccion', user.seccion); // Consulta todos los campos

//       if (error) throw error;

//       setCiudadanos(data); // Actualiza el estado con los datos obtenidos
//     } catch (error) {
//       console.error("Error",error.message);
//       setError(error.message);
//     }
//   };

//     useEffect(() => {
//     // fetchSecciones(); // Llama a la función al montar el componente
//     fetchCiudadanos();
//     // fetchPromotoras();
//   }, []);

  
  
  
//   if (error) {
//     return <p>Error: {error}</p>;
//   }

//   if (!user) {
//     return <p>Error: Usuario no encontrado</p>;
//   }
  
//   return (
//     <div className='mx-auto'>
//       {/* <h1>Perfil de {usuario}</h1> */}
//       <h1 className="border p-2">Bienvenido {user.nombre}</h1>
//       <p className="border p-2"><strong>Polígono:</strong> {user.poligono}</p>
//       <p className="border p-2"><strong>Delegación:</strong> {user.seccion}</p>
//       <p className="border p-2"><strong>Puesto:</strong> {user.puesto}</p>
//       {/* <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p> */}


//       <div className="border p-2">
//           <div className="flex gap-2">
//             <h1>12:00 HRS</h1>
//             <input
//               type="number"
//               value={reportData[['twelve'] || '']}
//               onChange={(e) => handleInputChange( 'twelve', e.target.value)}
//               className="border border-gray-300 rounded-md p-2 w-20"
//               required
//             />
//             <button 
//               onClick={() => handleSubmit('twelve')}
//               disabled={isSubmitting}
//               className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
//             >
//               {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
//             </button>
//           </div>
//         </div>
        
//         {/* 15:00 HRS */}
//         <div className="border p-2">
//           <div className="flex gap-2">
//             <h1>15:00 HRS</h1>
//             <input
//               type="number"
//               value={reportData['fifteen'] || ''}
//               onChange={(e) => handleInputChange('fifteen', e.target.value)}
//               className="border border-gray-300 rounded-md p-2 w-20"
//               required
//             />
//             <button 
//               onClick={() => handleSubmit( 'fifteen')}
//               disabled={isSubmitting}
//               className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
//             >
//               {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
//             </button>
//           </div>
//         </div>
        
//         {/* 18:00 HRS */}
//         <div className="border p-2">
//           <div className="flex gap-2">
//             <h1>18:00 HRS</h1>
//             <input
//               type="number"
//               value={reportData['eighteen'] || ''}
//               onChange={(e) => handleInputChange('eighteen', e.target.value)}
//               className="border border-gray-300 rounded-md p-2 w-20"
//               required
//             />
//             <button 
//               onClick={() => handleSubmit('eighteen')}
//               disabled={isSubmitting}
//               className="bg-rose-500 text-white px-4 py-2 rounded disabled:opacity-50"
//             >
//               {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
//             </button>
//           </div>
//         </div>
//       <div className='m-4'>
//       <button onClick={() => navigate(`/enlace/agregar/${user.usuario}`, {state: { user: user }})} className="bg-purple-500 text-white mx-auto my-auto px-4 py-2 rounded">
        
//         Agregar Ciudadano
//         </button>
//     </div>



//      < div className='my-8 mx-2'>
//         <h2 ><strong>CIUDADANOS</strong></h2>
//       </div>
//       <table className="w-full border-collapse border border-gray-300">
//         <thead>
//           <tr className="bg-gray-200">
//             {/* <th className="border p-2">Polígono</th> */}
//             <th className="border p-2">Delegación</th>
//             <th className="border p-2">SP</th>
//             <th className="border p-2">Nombre</th>
//             <th className="border p-2">CURP</th>
//             {/* <th className="border p-2">Puesto</th> */}
//           </tr>
//         </thead>
//       {ciudadanos.length > 0 ? (
//           <tbody>
//             {ciudadanos.map((resultado) => (
//               <tr key={resultado.id}>
//                 {/* <td className="border p-2">{resultado.poligono}</td> */}
//                 <td className="border p-2">{resultado.seccion}</td>
//                 <td className="border p-2">{resultado.sp}</td>
//                 <td className="border p-2">{resultado.nombre}</td>
//                 <td className="border p-2">{resultado.curp}</td>
//                 {/* <td className="border p-2">{resultado.puesto}</td> */}
                
//               </tr>
//             ))}
//           </tbody>
//         ) : (
//           <p>No se encontraron resultados.</p>
//         )}
//       </table>
//     </div>
//   );
// };

// export default Enlace;
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';

const Enlace = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();
  const [error, setError] = useState(null);
  const [ciudadanos, setCiudadanos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

const [reportData, setReportData] = useState({
  twelve: '',
  fifteen: '',
  eighteen: ''
});
const [isSubmitting, setIsSubmitting] = useState(false);
const handleInputChange = (time, value) => {
  setReportData(prev => ({
    ...prev,
    [time]: value
  }));
};

const handleSubmit = async (time) => {
  if (!reportData[time]) {
    alert('Por favor ingresa un valor');
    return;
  }

  setIsSubmitting(true);
  try {
    const { error } = await supabase
      .from('cortes_s')
      .upsert({
        delegacion: user.seccion,
        [time]: parseInt(reportData[time]),
        // fecha: new Date().toISOString().split('T')[0], // Guardar fecha actual
        // hora: time,
        // usuario: user.usuario // Registrar quién envió el reporte
      });

    if (error) throw error;
    
    alert('Reporte enviado exitosamente');
    // Limpiar solo el campo enviado
    setReportData(prev => ({...prev, [time]: ''}));
  } catch (error) {
    console.error('Error submitting report:', error);
    alert(`Error al enviar el reporte: ${error.message}`);
  } finally {
    setIsSubmitting(false);
  }
};

  // ... (aquí irían las funciones handleInputChange y handleSubmit mejoradas que mostré arriba)

  const fetchCiudadanos = async () => {
    try {
      const { data, error } = await supabase
        .from('servidores')
        .select('*')
        .eq('delegacion', user.seccion)
        .order('sp', { ascending: true });

      if (error) throw error;
      setCiudadanos(data || []);
    } catch (error) {
      console.error("Error cargando servidores:", error.message);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchCiudadanos();
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>Error: {error}</p>
        <button 
          onClick={() => setError(null)}
          className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  if (!user) {
    return <p className="p-4 bg-yellow-100">Error: Usuario no encontrado</p>;
  }

  return (
    <div className='mx-auto max-w-4xl p-4'>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h1 className="text-xl font-bold mb-2">Bienvenido {user.nombre}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <p><strong>Delegación:</strong> {user.seccion}</p>
          <p><strong>Puesto:</strong> {user.puesto}</p>
          {/* <p><strong>Usuario:</strong> {user.usuario}</p> */}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-bold mb-4">Reportes de Asistencia</h2>
        {/* Aquí irían los inputs de reporte mejorados */}

        {['twelve', 'fifteen', 'eighteen'].map((time) => (
  <div key={time} className="border p-2 mb-2">
    <div className="flex items-center gap-4">
      <h1 className="w-24 font-medium">
        {time === 'twelve' ? '12:00 HRS' : 
         time === 'fifteen' ? '15:00 HRS' : '18:00 HRS'}
      </h1>
      <input
        type="number"
        value={reportData[time] || ''}
        onChange={(e) => handleInputChange(time, e.target.value)}
        className="border border-gray-300 rounded-md p-2 w-20"
        required
        min="0"
      />
      <button 
        onClick={() => handleSubmit(time)}
        disabled={isSubmitting}
        className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
      </button>
      {reportData[time] && (
        <span className="text-green-600 ml-2">
          {reportData[time]} personas
        </span>
      )}
    </div>
  </div>
))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        {/* Aquí iría la tabla de servidores mejorada */}
        <div className='my-8 mx-2'>
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-bold"><strong>SERVIDORES</strong></h2>
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Buscar por nombre..."
        className="border p-2 rounded"
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button 
        onClick={fetchCiudadanos}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Actualizar
      </button>
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-200">
          <th className="border p-2">Delegación</th>
          <th className="border p-2">SP</th>
          <th className="border p-2">Nombre</th>
          <th className="border p-2">CURP</th>
          <th className="border p-2">Teléfono</th>
        </tr>
      </thead>
      <tbody>
        {ciudadanos.length > 0 ? (
          ciudadanos
            .filter(ciudadano => 
              ciudadano.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
              ciudadano.sp.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((ciudadano) => (
              <tr key={ciudadano.id} className="hover:bg-gray-50">
                <td className="border p-2">{ciudadano.delegacion}</td>
                <td className="border p-2">{ciudadano.sp}</td>
                <td className="border p-2">{ciudadano.nombre}</td>
                <td className="border p-2 font-mono">{ciudadano.curp}</td>
                <td className="border p-2">{ciudadano.telefono}</td>
              </tr>
            ))
        ) : (
          <tr>
            <td colSpan="5" className="border p-2 text-center">
              No se encontraron servidores
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
      </div>

      <div className="mt-4 text-center">
        <button 
          onClick={() => navigate(`/enlace/agregar/${user.usuario}`, {state: { user }})}
          className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded"
        >
          Agregar Nuevo Servidor
        </button>
      </div>
    </div>
  );
};

export default Enlace;