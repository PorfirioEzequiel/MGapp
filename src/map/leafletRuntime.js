import L from 'leaflet';

// Only the coordinate/value types used by the territorial views. No global
// window.google shim: other Google maps in the app retain their real SDK.
export class MapCoordinate {
  constructor(lat, lng) { this.latitude = Number(lat); this.longitude = Number(lng); }
  lat() { return this.latitude; }
  lng() { return this.longitude; }
}
export const asLeafletCoordinate = p => L.latLng(
  typeof p.lat === 'function' ? p.lat() : p.lat,
  typeof p.lng === 'function' ? p.lng() : p.lng
);
class MapBounds {
  constructor() { this.bounds = L.latLngBounds([]); }
  extend(p) { this.bounds.extend(asLeafletCoordinate(p)); return this; }
}
class MapSize {
  constructor(width, height) { this.width = width; this.height = height; }
}
export const leafletRuntime = { maps: {
  LatLngBounds: MapBounds,
  Size: MapSize,
  Point: L.Point,
  SymbolPath: { CIRCLE: 'circle' },
  ControlPosition: { RIGHT_CENTER: 'right' },
  event: {
    addListenerOnce: (facade, name, callback) => {
      const map = facade._leaflet;
      const event = name === 'idle' ? 'moveend' : name;
      map.once(event, callback);
      return { remove: () => map.off(event, callback) };
    },
    removeListener: listener => listener?.remove(),
  },
} };

export function createLeafletFacade(map) {
  let frame;
  let pending;
  let framed = false;
  let disposed = false;
  let moving = false;
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const cancel = () => {
    cancelAnimationFrame(frame);
    pending = null;
    map.stop?.();
  };
  const start = () => { moving = true; };
  const end = () => { moving = false; };
  map.on?.('movestart', start).on('moveend', end);
  const root = map.getContainer?.();
  // Native gestures always take priority over a queued camera movement.
  root?.addEventListener('pointerdown', cancel, { passive: true });
  root?.addEventListener('wheel', cancel, { passive: true });

  const navigate = target => {
    if (disposed) return;
    pending = target;
    cancelAnimationFrame(frame);
    // Coalesce panTo + setZoom and multiple fits from the existing effects.
    frame = requestAnimationFrame(() => {
      const next = pending;
      pending = null;
      if (disposed || !next) return;
      map.stop();
      const animate = !reducedMotion();
      const duration = Math.min(.9, .55 + Math.abs((next.zoom ?? map.getZoom()) - map.getZoom()) * .045);
      if (next.bounds) {
        const options = { ...next.padding, animate, duration };
        if (animate) map.flyToBounds(next.bounds, options);
        else map.fitBounds(next.bounds, options);
      } else if (!map.getCenter().equals(next.center, 1e-9) || map.getZoom() !== next.zoom) {
        if (animate) map.flyTo(next.center, next.zoom, { duration, easeLinearity: .25 });
        else map.setView(next.center, next.zoom, { animate: false });
      }
    });
  };

  return {
    provider: 'leaflet', _leaflet: map,
    isNavigating: () => moving,
    _disposeNavigation: () => {
      disposed = true;
      cancel();
      root?.removeEventListener('pointerdown', cancel);
      root?.removeEventListener('wheel', cancel);
      map.off?.('movestart', start).off('moveend', end);
    },
    getDiv: () => map.getContainer(),
    getZoom: () => map.getZoom(),
    getCenter: () => { const p = map.getCenter(); return new MapCoordinate(p.lat, p.lng); },
    setZoom: zoom => navigate({ center: pending?.center || map.getCenter(), zoom }),
    setCenter: p => navigate({ center: asLeafletCoordinate(p), zoom: pending?.zoom ?? map.getZoom() }),
    panTo: p => navigate({ center: asLeafletCoordinate(p), zoom: pending?.zoom ?? map.getZoom() }),
    fitBounds: (bounds, padding = 0) => {
      if (!bounds.bounds.isValid()) return;
      const inset = typeof padding === 'number'
        ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
      const paddingOptions = {
        paddingTopLeft: [inset.left || 0, inset.top || 0],
        paddingBottomRight: [inset.right || 0, inset.bottom || 0],
      };
      if (!framed) {
        framed = true;
        map.fitBounds(bounds.bounds, { ...paddingOptions, animate: false });
      } else navigate({ bounds: bounds.bounds, padding: paddingOptions });
    },
  };
}

export const translateMapEvent = event => ({
  latLng: event.latlng ? new MapCoordinate(event.latlng.lat, event.latlng.lng) : undefined,
  domEvent: event.originalEvent,
});
