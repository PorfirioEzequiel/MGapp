import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { useLocation, useParams } from 'react-router-dom';
import supabase from '../supabase/client';





const parseMultipolygon=(wkt) =>{
    wkt = String(wkt);
  const coordinatesString = wkt
        .replace('MULTIPOLYGON(((', '')
        .replace(')))', '');
    // Dividir en anillos exteriores (separados por paréntesis adicionales)
    const polygons = coordinatesString.split('),(');

    // Parsear las coordenadas y convertirlas en el formato deseado
    const resultado = [];
    polygons.forEach(polygon => {
        const points = polygon.split(',').map(coord => {
            const [longitude, latitude] = coord.trim().split(' ').map(Number);
            return { lat: latitude, lng: longitude };
        });
        resultado.push(...points);
    });
    resultado.shift();
    return resultado;
}
// console.log(parseMultipolygon(rows[1][16]));

const containerStyle = {
  width: '100%',
  height: '400px'
};
const center = {
  lat: 19.66,
  lng: -98.99
};




const MapComponent = (props) => {
    const { state } = useLocation();

    const [section, setSeccion] = useState([]);
    const [error, setError] = useState(null);
  
  
    const fetchSecciones = async () => {
      try {
        const { data, error } = await supabase
          .from('secciones') // Nombre de la tabla
          .select('*').eq("pologono",props.mapa);
          // .eq('seccion', user.seccion); // Consulta todos los campos
  
        if (error) throw error;
  
        setSeccion(data); // Actualiza el estado con los datos obtenidos
      } catch (error) {
        console.error("Error",error.message);
        setError(error.message);
      }
    };
  
      useEffect(() => {
      fetchSecciones(); // Llama a la función al montar el componente
  
    }, []);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: 'AIzaSyD0ZPIg4fiV9cQTESVzIrPXYEaXNpw7G3Q'
  });

  function  onEdit(){
    console.log("sec");
  };


  

  
  
  
  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={10}
    >

    {section.map((seccion)=>(
      
      <Polygon
        paths={parseMultipolygon(seccion.geometry)}
        // editable={true}
        // draggable={true}
        onMouseUp={onEdit()}
        // onClick={onEdit()}

        options={{
            fillOpacity: 0.2,
            strokeColor: "#AF272F",
            fillColor: "#AF272F",
            strokeWeight: 1
          }}
      />
    ))}


    </GoogleMap>
  ) : <></>;
};
export default MapComponent;