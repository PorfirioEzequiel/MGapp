import { prepareVectorStyle } from './vectorBasemapStyle';

const style = { version: 8, sources: { openmaptiles: { url: 'https://tiles.openfreemap.org/planet' } }, layers: [
  { id: 'road', type: 'line' }, {id:'building',type:'fill'},
  { id: 'highway-name-minor', type: 'symbol', layout: {'text-field':'name'} },
  { id: 'label_city', type: 'symbol', layout: {'text-field':'name'} },
  { id: 'poi', type: 'symbol' },
] };

test('Mínimo reduce referencias de fondo sin modificar fuentes o el estilo original', () => {
  const result = prepareVectorStyle(style, 'minimal');
  expect(result.layers.map(layer => layer.id)).toEqual(['road','label_city']);
  expect(result.layers[1].maxzoom).toBe(13);
  expect(result.sources).toEqual(style.sources);
  expect(style.layers).toHaveLength(5);
  expect(style.layers[3].maxzoom).toBeUndefined();
});

test('Oscuro conserva las etiquetas y mejora su contraste sin modificar el original', () => {
  const result = prepareVectorStyle(style, 'oscuro');
  expect(result.layers).toHaveLength(style.layers.length);
  expect(result.layers.find(layer => layer.id==='label_city').paint['text-color']).toBe('#edf0f3');
  expect(style.layers[3].paint).toBeUndefined();
});

test('Claro prioriza nombres locales y mantiene las fuentes y referencias originales', () => {
  const source = { ...style, layers: [{
    id: 'road-name', type: 'symbol', layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'ref']] },
  }] };
  const result = prepareVectorStyle(source, 'claro');
  expect(result.layers[0].layout['text-field']).toEqual([
    'coalesce', ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']], ['get', 'ref'],
  ]);
  expect(result.layers[0].paint['text-color']).toBe('#343a40');
  expect(result.sources).toEqual(source.sources);
  expect(source.layers[0].layout['text-field'][1]).toEqual(['get', 'name_en']);
});
