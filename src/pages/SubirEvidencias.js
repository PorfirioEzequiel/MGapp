import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';

const SubirEvidencias = () => {
  const { state } = useLocation();
  const { ciudadano, user } = state || {};
  const { id } = useParams();
  const [cantidad, setCantidad] = useState(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (index, e) => {
    const newFiles = [...files];
    newFiles[index] = e.target.files[0];
    setFiles(newFiles);
  };

  const handleSubmit = async () => {
    if (files.length < 1) {
      alert(`Por favor suba ${cantidad} evidencia(s)`);
      return;
    }

    setIsUploading(true);
    try {
      // Subir archivos
      const uploadPromises = files.slice(0, cantidad).map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${id}_${Date.now()}_${index}.${fileExt}`;
        const filePath = `evidencias/${fileName}`;

        const { error: uploadError } = await supabase
          .storage
          .from('evidencias')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        return filePath;
      });

      const uploadedPaths = await Promise.all(uploadPromises);

      // Registrar en la base de datos
      const { error: dbError } = await supabase
        .from('evidencias')
        .insert({
          ciudadano_id: id,
          cantidad: cantidad,
          archivos: uploadedPaths,
          poligono: ciudadano.poligono,
          seccion: ciudadano.seccion,
          ubt: ciudadano.ubt,
          nombre_ciudadano: `${ciudadano.nombre} ${ciudadano.a_paterno} ${ciudadano.a_materno}`,
          movilizador: ciudadano.movilizador,
          fecha: new Date().toISOString()
        });

      if (dbError) throw dbError;

    //   // Actualizar estado del ciudadano
    //   const { error: updateError } = await supabase
    //     .from('ciudadania')
    //     .update({ 
    //       status: 'ENTREGADO',
    //       cantidad_movilizados: cantidad 
    //     })
    //     .eq('id', id);

    //   if (updateError) throw updateError;

      alert('Evidencias subidas exitosamente');
      navigate(-1); // Volver a la página anterior
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!ciudadano) {
    return <p>Error: Ciudadano no encontrado</p>;
  }

  return (
    <div className="mx-auto p-4 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">Subir Evidencias para {ciudadano.nombre}</h1>
      
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-semibold">Polígono:</p>
            <p>{ciudadano.poligono}</p>
          </div>
          <div>
            <p className="font-semibold">Sección:</p>
            <p>{ciudadano.seccion}</p>
          </div>
          <div>
            <p className="font-semibold">UBT:</p>
            <p>{ciudadano.ubt}</p>
          </div>
          <div>
            <p className="font-semibold">Movilizador:</p>
            <p>{ciudadano.movilizador}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-medium">
          Cantidad de personas movilizadas:
        </label>
        <input
          type="number"
        //   min="0"
          value={cantidad}
          onChange={(e) => setCantidad( e.target.value)}
          className="border border-gray-300 rounded-md p-2 w-20"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Subir evidencias fotográficas ({cantidad}):</h2>
        <div className="grid gap-4">
          {[...Array(Number([1]))].map((_, index) => (
            <div key={index} className="border p-4 rounded-lg">
              <label className="block mb-2">Evidencia Fotográfica</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(index, e)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {files[index] && (
                <p className="mt-2 text-sm text-green-600">
                  Archivo seleccionado: {files[index].name}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          CANCELAR
        </button>
        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isUploading ? 'SUBIR...' : 'GUARDAR EVIDENCIAS'}
        </button>
      </div>
    </div>
  );
};

export default SubirEvidencias;