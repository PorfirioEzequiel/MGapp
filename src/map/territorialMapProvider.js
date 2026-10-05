import * as Google from '@react-google-maps/api';
import * as Leaflet from './LeafletMapAdapter';
import LeafletAddressSearch from './LeafletAddressSearch';
import { leafletRuntime } from './leafletRuntime';
import { IS_LEAFLET } from './territorialMapConfig';

const provider = IS_LEAFLET ? Leaflet : Google;
export const GoogleMap = provider.GoogleMap;
export const Polygon = provider.Polygon;
export const Marker = provider.Marker;
export const OverlayView = provider.OverlayView;
export const InfoWindow = provider.InfoWindow;
export const Autocomplete = IS_LEAFLET ? LeafletAddressSearch : Google.Autocomplete;
export const useJsApiLoader = provider.useJsApiLoader;
export const getMapRuntime = () => IS_LEAFLET ? leafletRuntime : window.google;

// Leaflet handles polygon dragging natively; never install Google's mouse fix
// on a Leaflet canvas or it would intercept its gestures.
export { IS_LEAFLET } from './territorialMapConfig';
