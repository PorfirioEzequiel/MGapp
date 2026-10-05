import L from 'leaflet';
import { LEAFLET_BASEMAPS } from './territorialMapConfig';

// Two pane pairs let a replacement load over the current map without blanking
// the cartography or recreating polygons, markers or the camera.
export function createBasemapController(map, onStatus) {
  let active = null;
  let incoming = null;
  let closed = false;
  let busyTimer;
  const groups = new Set();
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const status = value => { if (!closed) onStatus(value); };
  const remove = group => {
    if (!group) return;
    clearTimeout(group.deadline);
    clearTimeout(group.retireTimer);
    group.layers.forEach(layer => { layer.remove(); layer.off(); });
    groups.delete(group);
  };
  const show = (style, force = false) => {
    if (closed) return;
    clearTimeout(busyTimer);
    if (incoming) { remove(incoming); incoming = null; }
    [...groups].filter(group => group !== active).forEach(remove);
    if (active?.style === style && !force) {
      status({ loading: false, error: null });
      return;
    }
    const config = LEAFLET_BASEMAPS[style] || LEAFLET_BASEMAPS.claro;
    status({ loading: false, error: null });
    busyTimer = setTimeout(() => status({ loading: true, error: null }), 160);
    const slot = active?.slot === 0 ? 1 : 0;
    const pane = (name, zIndex, className) => {
      const element = map.getPane(name) || map.createPane(name);
      element.style.zIndex = String(zIndex);
      element.style.pointerEvents = 'none';
      element.className = `leaflet-pane territorial-basemap-pane ${className}`;
      element.style.opacity = active ? '0' : '1';
      return element;
    };
    const baseName = `territorialBase${slot}`;
    const labelName = `territorialReference${slot}`;
    const group = {
      style, slot, layers: [], done: new Set(), failed: false,
      base: pane(baseName, 198 + slot, `territorial-basemap-surface-${style}`),
      labels: pane(labelName, 410 + slot, `territorial-basemap-reference-${style}`),
    };
    incoming = group;
    groups.add(group);

    const complete = () => {
      if (closed || group.failed || incoming !== group || group.done.size !== group.layers.length) return;
      clearTimeout(group.deadline);
      clearTimeout(busyTimer);
      const previous = active;
      active = group;
      incoming = null;
      group.base.style.opacity = '1';
      group.labels.style.opacity = '1';
      status({ loading: false, error: null });
      if (previous) {
        previous.base.style.opacity = '0';
        previous.labels.style.opacity = '0';
        previous.retireTimer = setTimeout(() => remove(previous), reducedMotion() ? 0 : 220);
      }
    };
    const fail = () => {
      if (closed || !groups.has(group)) return;
      if (active === group) {
        clearTimeout(busyTimer);
        group.error = 'No se pudo completar el mapa base. Prueba otra vista; tus capas siguen disponibles.';
        status({ loading: false, error: group.error });
        return;
      }
      if (group.failed) return;
      group.failed = true;
      clearTimeout(group.deadline);
      clearTimeout(busyTimer);
      if (active) { remove(group); incoming = null; }
      status({ loading: false, error: active
        ? `No se pudo cargar ${config.label}. Se conserva la vista ${LEAFLET_BASEMAPS[active.style]?.label || active.style}.`
        : 'No se pudo completar el mapa base. Prueba otra vista; tus capas siguen disponibles.' });
    };
    const installRaster = () => {
      if (closed || incoming !== group || group.failed) return;
      clearTimeout(group.deadline);
      group.vectorFallback = true;
      group.layers.forEach(layer => { layer.remove(); layer.off(); });
      group.layers = []; group.done.clear();
      delete group.base.dataset.renderer;
      const definitions = [{ url: config.url, pane: baseName, attribution: config.attribution },
        ...(config.labels || []).map(label => ({ ...label, pane: labelName }))];
      definitions.forEach((definition, index) => {
        const layer = L.tileLayer(definition.url, {
          pane: definition.pane, attribution: definition.attribution,
          crossOrigin: 'anonymous', maxZoom: definition.maxZoom ?? 19,
          maxNativeZoom: definition.maxNativeZoom ?? config.maxNativeZoom,
          updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 3,
        });
        group.layers.push(layer);
        layer.on('tileerror', fail);
        layer.on('load', () => {
          group.done.add(index);
          complete();
          if (active === group && !incoming && group.layers.every(item => !item.isLoading())) {
            clearTimeout(busyTimer);
            status({ loading: false, error: group.error || null });
          }
        });
        layer.on('loading', () => {
          if (active !== group || incoming) return;
          group.error = null;
          clearTimeout(busyTimer);
          busyTimer = setTimeout(() => status({ loading: true, error: null }), 160);
        });
      });
      // Register every layer before adding: a cached tile may complete quickly.
      group.layers.forEach((layer, index) => {
        layer.addTo(map);
        if (!layer.isLoading()) group.done.add(index);
      });
      complete();
      if (incoming === group && !group.failed) group.deadline = setTimeout(fail, 15000);
    };
    if (config.vectorStyle) {
      group.deadline = setTimeout(installRaster, 15000);
      import('./vectorBasemapLayer').then(module => module.createVectorBasemap(config, baseName, style)).then(layer => {
        if (closed || incoming !== group || group.vectorFallback) return;
        group.base.dataset.renderer = 'vector';
        group.layers.push(layer);
        layer.addTo(map);
        const vector = layer.getMaplibreMap();
        vector.on('load', () => { group.done.add(0); complete(); });
        vector.on('error', () => {
          if (incoming === group) installRaster();
          else fail();
        });
        vector.on('dataloading', () => {
          if (active !== group || incoming) return;
          clearTimeout(busyTimer);
          busyTimer = setTimeout(() => status({ loading: true, error: null }), 160);
        });
        vector.on('idle', () => {
          if (active !== group || incoming) return;
          clearTimeout(busyTimer);
          status({ loading: false, error: null });
        });
      }).catch(installRaster);
    } else installRaster();
  };
  return {
    show,
    dispose: () => {
      closed = true;
      clearTimeout(busyTimer);
      [...groups].forEach(remove);
      active = null;
      incoming = null;
    },
  };
}
