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
  const [loading, setLoading] = useState(true);

  // Estado para los reportes de movilización
  const [movilizaciones, setMovilizaciones] = useState({});
  const [fotos, setFotos] = useState({});

  const handleInputChange = (spId, field, value) => {
    setMovilizaciones(prev => ({
      ...prev,
      [spId]: {
        ...prev[spId],
        [field]: value
      }
    }));
  };

  const handleFileChange = (spId, e) => {
    const file = e.target.files[0];
    if (file) {
      setFotos(prev => ({
        ...prev,
        [spId]: file
      }));
    }
  };

  const handleSubmit = async (spId) => {
    const reporte = movilizaciones[spId];
    if (!reporte || reporte.participo === undefined) {
      alert('Por favor indica si participó');
      return;
    }

    if (reporte.participo === 'si' && !reporte.cantidad) {
      alert('Por favor ingresa la cantidad movilizada');
      return;
    }

    try {
      setLoading(true);
      
      // Subir foto si existe
      let fotoUrl = null;
      if (fotos[spId]) {
        const fileExt = fotos[spId].name.split('.').pop();
        const fileName = `${spId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('evidencias-movilizacion')
          .upload(`evidencias/${fileName}`, fotos[spId]);
        
        if (uploadError) throw uploadError;
        
        // Obtener URL pública
        const { data: urlData } = supabase.storage
          .from('evidencias-movilizacion')
          .getPublicUrl(`evidencias/${fileName}`);
        
        fotoUrl = urlData.publicUrl;
      }

      // Guardar reporte en la base de datos
      const { error } = await supabase
        .from('reportes_movilizacion')
        .upsert({
          sp_id: spId,
          participo: reporte.participo === 'si',
          cantidad: reporte.participo === 'si' ? parseInt(reporte.cantidad) : 0,
          evidencia_url: fotoUrl,
          delegacion: user.seccion,
          reportado_por: user.usuario,
          fecha: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;
      
      alert('Reporte enviado exitosamente');
      
      // Actualizar lista para mostrar el estado
      setCiudadanos(prev => prev.map(sp => 
        sp.id === spId ? { ...sp, reportado: true } : sp
      ));
      
    } catch (error) {
      console.error('Error enviando reporte:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCiudadanos = async () => {
    try {
      setLoading(true);
      const { data: servidores, error } = await supabase
        .from('servidores')
        .select('*')
        .eq('delegacion', user.seccion)
        .order('sp', { ascending: true });

      if (error) throw error;

      // Obtener reportes existentes para hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { data: reportes } = await supabase
        .from('reportes_movilizacion')
        .select('sp_id, participo, cantidad')
        .eq('fecha', hoy)
        .eq('delegacion', user.seccion);

      // Marcar los SP que ya han reportado
      const servidoresConEstado = servidores.map(sp => {
        const reporte = reportes.find(r => r.sp_id === sp.id);
        return {
          ...sp,
          reportado: !!reporte,
          participo: reporte?.participo,
          cantidad: reporte?.cantidad
        };
      });

      setCiudadanos(servidoresConEstado || []);
    } catch (error) {
      console.error("Error cargando servidores:", error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.seccion) {
      fetchCiudadanos();
    }
  }, [user]);

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
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">REPORTE DE MOVILIZACIÓN POR SP</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar SP..."
              className="border p-2 rounded"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button 
              onClick={fetchCiudadanos}
              className="bg-blue-500 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {loading ? (
          <p>Cargando servidores...</p>
        ) : (
          <div className="space-y-4">
            {ciudadanos
              .filter(ciudadano => 
                ciudadano.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ciudadano.sp.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((ciudadano) => (
                <div key={ciudadano.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">
                      {ciudadano.nombre}
                      {ciudadano.reportado && (
                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          Reportado
                        </span>
                      )}
                    </h3>
                    {/* <span className="text-sm text-gray-500">Tel: {ciudadano.telefono}</span> */}
                  </div>

                  {ciudadano.reportado ? (
                    <div className="bg-green-50 p-3 rounded">
                      <p>
                        <strong>Estado:</strong> {ciudadano.participo ? 'Participó' : 'No participó'}
                      </p>
                      {ciudadano.participo && (
                        <p>
                          <strong>Movilizó:</strong> {ciudadano.cantidad} personas
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block mb-1">¿Participó en la movilización?</label>
                        <div className="flex gap-4">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`participacion-${ciudadano.id}`}
                              value="si"
                              onChange={(e) => handleInputChange(ciudadano.id, 'participo', e.target.value)}
                              className="mr-2"
                            />
                            Sí
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`participacion-${ciudadano.id}`}
                              value="no"
                              onChange={(e) => handleInputChange(ciudadano.id, 'participo', e.target.value)}
                              className="mr-2"
                            />
                            No
                          </label>
                        </div>
                      </div>

                      {movilizaciones[ciudadano.id]?.participo === 'si' && (
                        <div>
                          <label className="block mb-1">¿Cuántas personas movilizó?</label>
                          <input
                            type="number"
                            min="0"
                            className="border p-2 rounded w-full max-w-xs"
                            onChange={(e) => handleInputChange(ciudadano.id, 'cantidad', e.target.value)}
                          />
                        </div>
                      )}

                      <div>
                        <label className="block mb-1">Evidencia fotográfica</label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="border p-2 rounded w-full"
                          onChange={(e) => handleFileChange(ciudadano.id, e)}
                          // required
                        />
                      </div>

                      <button
                        onClick={() => handleSubmit(ciudadano.id)}
                        disabled={loading || !movilizaciones[ciudadano.id]?.participo}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded disabled:opacity-50"
                      >
                        {loading ? 'Enviando...' : 'Enviar Reporte'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
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