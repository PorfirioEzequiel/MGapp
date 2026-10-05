jest.mock('@react-google-maps/api', () => ({
  GoogleMap: jest.fn(), useJsApiLoader: jest.fn(), Polygon: jest.fn(), Marker: jest.fn(),
  OverlayView: jest.fn(), InfoWindow: jest.fn(), Autocomplete: jest.fn(),
}));

test('la prueba usa Leaflet sin crear una API global de Google', () => {
  delete window.google;
  const provider = require('./territorialMapProvider');
  expect(provider.IS_LEAFLET).toBe(true);
  expect(provider.GoogleMap).toBe(require('./LeafletMapAdapter').GoogleMap);
  expect(provider.getMapRuntime().maps.LatLngBounds).toBeDefined();
  expect(window.google).toBeUndefined();
});

test('la opción google recupera los componentes y el SDK originales', () => {
  process.env.REACT_APP_TERRITORIAL_MAP_PROVIDER = 'google';
  window.google = { maps: { original: true } };
  try {
    jest.isolateModules(() => {
      const provider = require('./territorialMapProvider');
      expect(provider.IS_LEAFLET).toBe(false);
      expect(provider.GoogleMap).toBe(require('@react-google-maps/api').GoogleMap);
      expect(provider.getMapRuntime()).toBe(window.google);
    });
  } finally { delete process.env.REACT_APP_TERRITORIAL_MAP_PROVIDER; delete window.google; }
});
