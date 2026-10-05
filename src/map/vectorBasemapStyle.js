// Only the base map's styling is adjusted. Territorial sources never enter here.
export function prepareVectorStyle(source, variant) {
  const style = JSON.parse(JSON.stringify(source));
  const localNames = expression => {
    if (!Array.isArray(expression)) return expression;
    if (expression[0] === 'get' && ['name_en', 'name:en'].includes(expression[1])) {
      return ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']];
    }
    return expression.map(localNames);
  };
  style.layers.filter(layer => layer.type === 'symbol' && layer.layout?.['text-field']).forEach(layer => {
    layer.layout['text-field'] = localNames(layer.layout['text-field']);
  });
  if (variant === 'minimal') {
    style.layers = style.layers.filter(layer => {
      if (layer.type === 'symbol') return /^label_(city|city_capital|town|state|country)/.test(layer.id);
      return !/building|poi/.test(layer.id);
    });
    style.layers.filter(layer => layer.type === 'symbol').forEach(layer => {
      layer.maxzoom = Math.min(layer.maxzoom ?? 24, 13);
    });
  }
  if (variant === 'claro' || variant === 'oscuro') {
    style.layers.filter(layer => layer.type === 'symbol' && layer.layout?.['text-field']).forEach(layer => {
      layer.paint = {
        ...layer.paint,
        'text-color': variant === 'oscuro' ? '#edf0f3' : '#343a40',
        'text-halo-color': variant === 'oscuro' ? '#11151b' : '#fff',
        'text-halo-width': 1.1,
      };
    });
  }
  return style;
}
