import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';

const Perfil = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();

  const [error, setError] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const [ciudadanos, setCiudadanos] = useState([]);
  const [filteredCiudadanos, setFilteredCiudadanos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ubtFilter, setUbtFilter] = useState('');
  const navigate = useNavigate();
  const [reportData, setReportData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtros para ciudadanos
  useEffect(() => {
    let results = ciudadanos;
    
    if (ubtFilter) {
      results = results.filter(c => c.ubt.toString().includes(ubtFilter));
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(c => 
        c.nombre.toLowerCase().includes(term) || 
        c.a_paterno.toLowerCase().includes(term) ||
        c.a_materno.toLowerCase().includes(term)
      );
    }
    
    setFilteredCiudadanos(results);
  }, [ciudadanos, ubtFilter, searchTerm]);

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
      const promotor = promotores.find(p => p.id === promotorId);
      if (!promotor) throw new Error('Promotor no encontrado');
      
      const { error } = await supabase
        .from('cortes')
        .upsert({
          promotor_id: promotorId,
          poligono: promotor.poligono,
          seccion: promotor.seccion,
          ubt: promotor.ubt,
          pb: `${promotor.nombre} ${promotor.a_paterno} ${promotor.a_materno}`,
          [time]: reportData[promotorId][time],
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

  const fetchPromotoras = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq("seccion", user.seccion)
        .eq("puesto", "PROMOTORA-BIENESTAR")
        .eq("status", "ACTIVO")
        .order('ubt', { ascending: true });

      if (error) throw error;
      setPromotores(data);
    } catch (error) {
      console.error("Error", error.message);
      setError(error.message);
    }
  };

  const fetchCiudadanos = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq("seccion", user.seccion)
        .or('puesto.eq.MOVILIZADOR,puesto.eq.MOVILIZADOR')
        .order('puesto', { ascending: false })
        .order('ubt', { ascending: true });

      if (error) throw error;
      setCiudadanos(data);
      setFilteredCiudadanos(data);
    } catch (error) {
      console.error("Error", error.message);
      setError(error.message);
    }
  };

  useEffect(() => {
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
    <div className='mx-auto p-4'>
      <h1 className="text-xl font-bold border-b pb-2 mb-4">Bienvenido {user.nombre} {user.a_paterno} {user.a_materno}</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="border p-2 rounded">
          <strong>Polígono:</strong> {user.poligono}
        </div>
        <div className="border p-2 rounded">
          <strong>Sección:</strong> {user.seccion}
        </div>
        <div className="border p-2 rounded">
          <strong>Puesto:</strong> {user.puesto}
        </div>
        <div className="border p-2 rounded">
          <strong>Promotor@s:</strong> {promotores.length}
        </div>
      </div>
      
      {/* <button 
        onClick={() => navigate(`/seccional/agregar/${user.usuario}`, {state: { user }})} 
        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mb-6"
      >
        Agregar Ciudadano
      </button> */}

      {/* Tabla de Promotores */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">PROMOTORES DEL BIENESTAR</h2>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Polígono</th>
              <th className="border p-2">Sección</th>
              <th className="border p-2">UBT</th>
              <th className="border p-2">Nombre</th>
              <th className="border p-2">Puesto</th>
              {/* <th className="border p-2">18:00 HRS</th> */}
            </tr>
          </thead>
          <tbody>
            {promotores.length > 0 ? (
              promotores.map((promotor) => (
                <tr key={promotor.id}>
                  <td className="border p-2">{promotor.poligono}</td>
                  <td className="border p-2">{promotor.seccion}</td>
                  <td className="border p-2">{promotor.ubt}</td>
                  <td className="border p-2">{promotor.nombre} {promotor.a_paterno} {promotor.a_materno}</td>
                  <td className="border p-2">{promotor.puesto}</td>
                  {/* <td className="border p-2">
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
                        className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded disabled:opacity-50"
                      >
                        {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
                      </button>
                    </div>
                  </td> */}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center p-2">No se encontraron promotores</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Filtros para Ciudadanos */}
      <div className='mb-6'>
        <h2 className="text-lg font-semibold mb-2">CIUDADANOS</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block mb-1 font-medium">Buscar por UBT:</label>
            <input
              type="text"
              value={ubtFilter}
              onChange={(e) => setUbtFilter(e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-full"
              placeholder="Número de UBT"
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium">Buscar por nombre:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-md p-2 w-full"
              placeholder="Nombre del ciudadano"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Ciudadanos */}
      <table className="w-full border-collapse border border-gray-300 mb-8">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Movilizador</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredCiudadanos.length > 0 ? (
            filteredCiudadanos.map((ciudadano) => (
              <tr key={ciudadano.id}>
                <td className="border p-2">{ciudadano.poligono}</td>
                <td className="border p-2">{ciudadano.seccion}</td>
                <td className="border p-2">{ciudadano.ubt}</td>
                <td className="border p-2">{ciudadano.nombre} {ciudadano.a_paterno} {ciudadano.a_materno}</td>
                <td className="border p-2">{ciudadano.puesto}</td>
                <td className="border p-2">{ciudadano.movilizador}</td>
                <td className="border p-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/subir-evidencias/${ciudadano.id}`, { 
                        state: { 
                          ciudadano,
                          user 
                        } 
                      })}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      SUBIR EVIDENCIAS
                    </button>
                    <button 
                      onClick={() => navigate(`/ciudadanoE/${ciudadano.id}`)}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      EDITAR
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center p-4">No se encontraron ciudadanos</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Perfil;