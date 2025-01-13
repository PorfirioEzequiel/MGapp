import React, { useCallback, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';





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
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: 'AIzaSyD0ZPIg4fiV9cQTESVzIrPXYEaXNpw7G3Q'
  });
  // const [path, setPath] = useState([
  //   { lat: -3.745, lng: -38.523 },
  //   { lat: -3.745, lng: -38.533 },
  //   { lat: -3.745, lng: -38.55 },
  //   { lat: -3.755, lng: -38.533 }
  // ]);

    const path=parseMultipolygon(props.mapa);
    

  
  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={10}
    >
      <Polygon
        paths={path}
        // editable={true}
        // draggable={true}
        // onMouseUp={onEdit}
        options={{
            fillOpacity: 0.1,
            strokeColor: "#ff0000",
            fillColor: "#FF0000",
            strokeWeight: 1
          }}
      />


    </GoogleMap>
  ) : <></>;
};
export default MapComponent;