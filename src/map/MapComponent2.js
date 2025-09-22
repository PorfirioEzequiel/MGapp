import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, InfoWindow } from '@react-google-maps/api';
import { useLocation, useParams } from 'react-router-dom';
import supabase from '../supabase/client';

// Función para parsear multipolígonos WKT
const parseMultipolygon = (wkt) => {
    wkt = String(wkt);
    const coordinatesString = wkt
        .replace('MULTIPOLYGON(((', '')
        .replace(')))', '');
    const polygons = coordinatesString.split('),(');

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
};

// Paleta de colores para diferenciar secciones
const COLOR_PALETTE = [
    { fill: '#FF6B6B', stroke: '#C53B3B' }, // Rojo
    { fill: '#4ECDC4', stroke: '#2A9D8F' }, // Verde azulado
    { fill: '#FFD166', stroke: '#F4A261' }, // Amarillo
    { fill: '#6A0572', stroke: '#4A0366' }, // Púrpura
    { fill: '#118AB2', stroke: '#0A5A78' }, // Azul
    { fill: '#06D6A0', stroke: '#04A77D' }, // Verde
    { fill: '#7209B7', stroke: '#560BAD' }, // Violeta
    { fill: '#F15BB5', stroke: '#DE0D92' }, // Rosa
    { fill: '#3A86FF', stroke: '#2667CC' }, // Azul claro
    { fill: '#FB5607', stroke: '#D34506' }, // Naranja
];

// Función para obtener un color basado en un ID
const getColorByIndex = (index) => {
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
};

const containerStyle = {
    width: '100%',
    height: '400px'
};

const center = {
    lat: 19.66,
    lng: -98.99
};

const MapComponent2 = (props) => {
    const { state } = useLocation();
    const [section, setSeccion] = useState([]);
    const [error, setError] = useState(null);
    const [selectedPolygon, setSelectedPolygon] = useState(null);
    const [hoveredPolygon, setHoveredPolygon] = useState(null);
    
    // Estado para controlar colores personalizados
    const [customColors, setCustomColors] = useState({});

    const fetchSecciones = async () => {
        try {
            const { data, error } = await supabase
                .from('secciones')
                .select('*')
                .eq("pologono", props.mapa);

            if (error) throw error;

            setSeccion(data);
        } catch (error) {
            console.error("Error", error.message);
            setError(error.message);
        }
    };

    useEffect(() => {
        fetchSecciones();
    }, []);

    // Función para manejar el clic en un polígono
    const handlePolygonClick = useCallback((seccion) => {
        setSelectedPolygon(selectedPolygon === seccion.id ? null : seccion.id);
    }, [selectedPolygon]);

    // Función para manejar el hover sobre un polígono
    const handleMouseOver = useCallback((seccion) => {
        setHoveredPolygon(seccion.id);
    }, []);

    // Función para manejar el hover fuera de un polígono
    const handleMouseOut = useCallback(() => {
        setHoveredPolygon(null);
    }, []);

    // Función para cambiar el color de un polígono específico
    const changePolygonColor = (seccionId, fillColor, strokeColor) => {
        setCustomColors(prev => ({
            ...prev,
            [seccionId]: { fill: fillColor, stroke: strokeColor }
        }));
    };

    // Función para restablecer todos los colores
    const resetAllColors = () => {
        setCustomColors({});
    };

    // Función para obtener el color actual de un polígono
    const getCurrentColor = (seccion, index) => {
        // Si hay un color personalizado, usarlo
        if (customColors[seccion.id]) {
            return customColors[seccion.id];
        }
        
        // Si está seleccionado, usar un color destacado
        if (selectedPolygon === seccion.id) {
            return { fill: '#FFFF00', stroke: '#CCCC00' }; // Amarillo destacado
        }
        
        // Si está siendo hover, hacerlo más oscuro
        if (hoveredPolygon === seccion.id) {
            const baseColor = getColorByIndex(index);
            return {
                fill: baseColor.fill,
                stroke: '#000000', // Borde negro para destacar
            };
        }
        
        // Color por defecto según el índice
        return getColorByIndex(index);
    };

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: 'AIzaSyD0ZPIg4fiV9cQTESVzIrPXYEaXNpw7G3Q'
    });

    if (!isLoaded) return <div className="p-4 text-center">Cargando mapa...</div>;

    return (
        <div className="w-full">
            {/* Controles de color */}
            <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="font-bold mb-2">Personalización de colores</h3>
                <button 
                    onClick={resetAllColors}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                >
                    Restablecer colores
                </button>
                <span className="text-sm text-gray-600">
                    Haz clic en un polígono para seleccionarlo y personalizar su color
                </span>
                
                {selectedPolygon && (
                    <div className="mt-2">
                        <p className="text-sm mb-1">Cambiar color de la sección {selectedPolygon}:</p>
                        <div className="flex gap-2">
                            {COLOR_PALETTE.slice(0, 5).map((color, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => changePolygonColor(
                                        selectedPolygon, 
                                        color.fill, 
                                        color.stroke
                                    )}
                                    className="w-6 h-6 rounded-full border border-gray-300"
                                    style={{ backgroundColor: color.fill }}
                                    title={`Color ${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Mapa */}
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={10}
            >
                {section.map((seccion, index) => {
                    const colors = getCurrentColor(seccion, index);
                    
                    return (
                        <React.Fragment key={seccion.id}>
                            <Polygon
                                paths={parseMultipolygon(seccion.geometry)}
                                onClick={() => handlePolygonClick(seccion)}
                                onMouseOver={() => handleMouseOver(seccion)}
                                onMouseOut={handleMouseOut}
                                options={{
                                    fillColor: colors.fill,
                                    strokeColor: colors.stroke,
                                    strokeWeight: selectedPolygon === seccion.id ? 3 : 2,
                                    fillOpacity: hoveredPolygon === seccion.id || selectedPolygon === seccion.id ? 0.6 : 0.4,
                                }}
                            />
                            
                            {/* InfoWindow para mostrar información al hacer clic */}
                            {selectedPolygon === seccion.id && (
                                <InfoWindow
                                    position={getPolygonCenter(parseMultipolygon(seccion.geometry))}
                                    onCloseClick={() => setSelectedPolygon(null)}
                                >
                                    <div className="p-2">
                                        <h3 className="font-bold">Sección {seccion.seccion}</h3>
                                        <p>Lista nominal: {seccion.lista_nominal}</p>
                                        <button 
                                            onClick={() => setSelectedPolygon(null)}
                                            className="mt-2 px-2 py-1 bg-gray-200 rounded text-sm"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </InfoWindow>
                            )}
                        </React.Fragment>
                    );
                })}
            </GoogleMap>
            
            {/* Leyenda de colores */}
            <div className="mt-4 p-3 bg-white border rounded-lg">
                <h4 className="font-bold mb-2">Leyenda de secciones</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {section.slice(0, 10).map((seccion, index) => (
                        <div key={seccion.id} className="flex items-center">
                            <div 
                                className="w-4 h-4 mr-2"
                                style={{ 
                                    backgroundColor: getColorByIndex(index).fill,
                                    border: `1px solid ${getColorByIndex(index).stroke}`
                                }}
                            />
                            <span className="text-sm">Sección {seccion.seccion}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Función auxiliar para calcular el centro de un polígono
const getPolygonCenter = (paths) => {
    if (!paths || paths.length === 0) return center;
    
    let latSum = 0;
    let lngSum = 0;
    
    paths.forEach(point => {
        latSum += point.lat;
        lngSum += point.lng;
    });
    
    return {
        lat: latSum / paths.length,
        lng: lngSum / paths.length
    };
};

export default MapComponent2;