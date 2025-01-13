import React, { useState } from "react";
import supabase from '../supabase/client';
import { useLocation, useParams } from "react-router-dom";


const WaterSurveyForm = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();

  const [location, setLocation] = useState(null);
  const [quality, setQuality] = useState("");
  const [abundance, setAbundance] = useState("");
  const [message, setMessage] = useState("");


  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          setMessage("Ubicación obtenida correctamente.");
        },
        (error) => {
          setMessage("Error al obtener la ubicación: " + error.message);
        }
      );
    } else {
      setMessage("La geolocalización no es compatible con tu navegador.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          // setMessage("Ubicación obtenida correctamente.");


          
        },
        (error) => {
          setMessage("Error al obtener la ubicación: " + error.message);
        }
      );
    } else {
      setMessage("La geolocalización no es compatible con tu navegador.");
    }

    if (!location || !quality || !abundance) {
      setMessage("Por favor, completa todos los campos.");
      return;
    }

    
    const reportData = {
      poligono: user.poligono,
      seccion: user.seccion,
      ubt: user.ubt,
      pb: user.nombre+" "+user.a_paterno+" "+user.a_materno,
      fecha_reporte: new Date(),
      latitud_reporte: location.latitude,
      longitud_reporte: location.longitude,
      // ubicacion: `POINT(${location.longitude} ${location.latitude})`, // Formato para columna de tipo `geography`
      calidad_agua: quality,
      abundancia_agua: abundance,
    };

    try {
      const { data, error } = await supabase.from("reporte-agua").insert([reportData]);

      if (error) {
        console.error("Error al guardar los datos:", error);
        setMessage("Hubo un error al enviar la información.");
        return;
      }

      setMessage("¡Reporte enviado correctamente!");
      setQuality("");
      setAbundance("");
      setLocation(null);
    } catch (error) {
      console.error("Error inesperado:", error);
      setMessage("Ocurrió un error al enviar el reporte.");
    }
  };

  return (
    <div class="max-w-md mx-auto mt-10 bg-white shadow-lg rounded-lg overflow-hidden">
      <div class="text-2xl py-4 px-6 bg-blue-600 text-white text-center font-bold uppercase">
        REPORTE DE CALIDAD DEL AGUA
    </div>
    <form onSubmit={handleSubmit} class="py-4 px-6">
      
        <div class="mb-4">
          
        </div>
          
          <p class="block text-gray-700 font-bold mb-2">POLÍGONO: {user.poligono}</p>
          
          <p class="block text-gray-700 font-bold mb-2">SECCIÓN: {user.seccion}</p>
          
          <p class="block text-gray-700 font-bold mb-2">UBT: {user.ubt}</p>
          <p class="block text-gray-700 font-bold mb-2">PB: {user.nombre} {user.a_paterno} {user.a_materno}</p>
          
        
        
          <button type="button" class="bg-blue-800 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:shadow-outline"
                 onClick={getLocation}>
            Obtener ubicación actual
          </button>
          {location && (
            <p class="block text-gray-700 font-bold mb-2">
              Ubicación: {location.latitude}, {location.longitude}
            </p>
          )}
       

       <div class="mb-4">
          <label for="quality" class="block text-gray-700 font-bold mb-2">Calidad del Agua:</label>
          
          <select value={quality} onChange={(e) => setQuality(e.target.value)} 
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
            <option value="">Seleccionar</option>
            <option value="Buena">Buena</option>
            <option value="Regular">Regular</option>
            <option value="Mala">Mala</option>
          </select>
        </div>
          
          
        <div class="mb-4">
          <label class="block text-gray-700 font-bold mb-2">Abundancia del Agua:</label>
          <select value={abundance} onChange={(e) => setAbundance(e.target.value)}
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
            <option value="">Seleccionar</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
        

        
          <button type="submit" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Enviar Reporte</button>
        

        {message && <p>{message}</p>}
      
    </form>

    </div>
  );
};

export default WaterSurveyForm;
