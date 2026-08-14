import React, { useCallback, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../utils/googleMapsConfig';





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
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
 const path=parseMultipolygon(props.mapa);
  
  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={15}
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