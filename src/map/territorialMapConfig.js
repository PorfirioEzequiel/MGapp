// Local Leaflet trial. Set this to 'google' to restore the existing renderer.
// An environment override also allows comparing providers without changing data.
export const TERRITORIAL_MAP_PROVIDER = process.env.REACT_APP_TERRITORIAL_MAP_PROVIDER || 'leaflet';
export const IS_LEAFLET = TERRITORIAL_MAP_PROVIDER === 'leaflet';

const esri = 'https://services.arcgisonline.com/ArcGIS/rest/services';
const vectorStyle = name => process.env.REACT_APP_TERRITORIAL_VECTOR_BASEMAPS === 'false' ? null : `https://tiles.openfreemap.org/styles/${name}`;
const vectorAttribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const LEAFLET_BASEMAPS = {
  claro: {
    label: 'Claro',
    description: 'Calles, colonias, vialidades y lugares sobre fondo claro · OpenFreeMap',
    vectorStyle: vectorStyle('liberty'), vectorAttribution,
    url: `${esri}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCAN, Esri Japan, METI, Esri China (Hong Kong), NOSTRA, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxNativeZoom: 19,
  },
  satelite: {
    label: 'Satélite',
    description: 'Imagen aérea con calles y nombres de lugares · Esri Imagery',
    url: `${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    labels: [
      { url: `${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}` },
      { url: `${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` },
    ],
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxNativeZoom: 19,
  },
  minimal: {
    label: 'Mínimo',
    description: 'Fondo claro con referencias esenciales para destacar los datos territoriales · OpenFreeMap',
    vectorStyle: vectorStyle('positron'), vectorAttribution,
    url: `${esri}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: [{ url: `${esri}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, maxZoom: 12 }],
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxNativeZoom: 16,
  },
  oscuro: {
    label: 'Oscuro',
    description: 'Fondo carbón con calles y nombres claros · OpenFreeMap',
    vectorStyle: vectorStyle('dark'), vectorAttribution,
    url: `${esri}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: [{ url: `${esri}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}` }],
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxNativeZoom: 16,
  },
};

// Public demo for modest LOCAL testing; configurable for a production service.
export const ADDRESS_SEARCH_URL = process.env.REACT_APP_TERRITORIAL_GEOCODER_URL || 'https://photon.komoot.io/api/';
