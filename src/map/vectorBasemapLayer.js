import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl, setWorkerCount } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { prepareVectorStyle } from './vectorBasemapStyle';

setWorkerUrl(`${process.env.PUBLIC_URL || ''}/maplibre/maplibre-gl-worker.mjs`);
setWorkerCount(2);
const styles = new Map();
let checkedWebGL = false;

export async function createVectorBasemap(config, pane, variant) {
  if (!checkedWebGL) {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) throw new Error('Cartografía vectorial no disponible en este equipo.');
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    checkedWebGL = true;
  }
  if (!styles.has(config.vectorStyle)) {
    const promise = fetch(config.vectorStyle).then(response => {
      if (!response.ok) throw new Error('El estilo cartográfico no está disponible.');
      return response.json();
    }).catch(error => { styles.delete(config.vectorStyle); throw error; });
    styles.set(config.vectorStyle, promise);
  }
  const style = prepareVectorStyle(await styles.get(config.vectorStyle), variant);
  return maplibreGL({
    pane, style, interactive: false, updateInterval: 16, padding: .15,
    attributionControl: { customAttribution: config.vectorAttribution },
    renderWorldCopies: false, fadeDuration: 120,
  });
}
