import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './leafletTerritorial.css';
import { LEAFLET_BASEMAPS } from './territorialMapConfig';
import { createBasemapController } from './leafletBasemaps';
import { asLeafletCoordinate, createLeafletFacade, translateMapEvent } from './leafletRuntime';

const MapContext = createContext(null);
const BasemapAppearanceContext = createContext('claro');
export const useJsApiLoader = () => ({ isLoaded: true });

// Keep the existing view's props and callbacks, while using Leaflet's own
// dragging, touch zoom and click-vs-drag handling for all drawing surfaces.
export function GoogleMap(props) {
  const container = useRef(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [context, setContext] = useState(null);
  const [basemapStatus, setBasemapStatus] = useState({ loading: false, error: null });
  const baseStyle = props.baseStyle || 'claro';

  useEffect(() => {
    const initial = callbacks.current;
    const options = initial.options || {};
    const animate = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
    const map = L.map(container.current, {
      center: asLeafletCoordinate(initial.center), zoom: initial.zoom,
      minZoom: options.minZoom ?? 3, maxZoom: options.maxZoom ?? 19,
      // SVG keeps hover/selection updates local to each path and transforms
      // the territorial geometry smoothly with the native camera animation.
      zoomControl: false, preferCanvas: false,
      scrollWheelZoom: options.gestureHandling !== 'cooperative',
      touchZoom: true, dragging: true, attributionControl: true,
      zoomSnap: .5, zoomDelta: 1, wheelDebounceTime: 35, wheelPxPerZoomLevel: 100,
      zoomAnimation: animate, fadeAnimation: animate, markerZoomAnimation: animate,
      inertia: animate, inertiaMaxSpeed: 1200,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    if (options.scaleControl) L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    map.createPane('territorialLabels').style.zIndex = '450';
    map.getPane('territorialLabels').style.pointerEvents = 'none';
    map.createPane('territorialCards').style.zIndex = '650';
    map.getPane('territorialCards').style.pointerEvents = 'none';
    const facade = createLeafletFacade(map);
    const vectors = new Set();
    let sortFrame;
    const reorder = () => {
      cancelAnimationFrame(sortFrame);
      sortFrame = requestAnimationFrame(() => {
        if (!instance.active) return;
        [...vectors].filter(layer => map.hasLayer(layer)).sort((a, b) => a.territorialZ - b.territorialZ).forEach(layer => layer.bringToFront());
      });
    };
    const click = e => callbacks.current.onClick?.(translateMapEvent(e));
    let hoverFrame;
    const move = e => {
      if (facade.isNavigating()) return;
      cancelAnimationFrame(hoverFrame);
      hoverFrame = requestAnimationFrame(() => callbacks.current.onMouseMove?.(translateMapEvent(e)));
    };
    const zoom = () => callbacks.current.onZoomChanged?.();
    map.on('click', click).on('mousemove', move).on('zoomend', zoom);
    const resize = () => map.invalidateSize({ pan: false });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(container.current);
    window.addEventListener('resize', resize);
    // Child effects may replay before the new context is committed in Fast Refresh.
    const instance = { map, facade, vectors, reorder, basemaps: createBasemapController(map, setBasemapStatus), active: true };
    setContext(instance);
    initial.onLoad?.(facade);
    return () => {
      instance.active = false;
      cancelAnimationFrame(sortFrame);
      cancelAnimationFrame(hoverFrame);
      instance.basemaps.dispose();
      facade._disposeNavigation();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      callbacks.current.onUnmount?.(facade);
      // Remove paths before their Canvas renderer: their cleanup must not
      // schedule a redraw after the drawing context has been disposed.
      map.eachLayer(layer => {
        if (layer instanceof L.Path) layer.remove();
      });
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!context?.active) return;
    context.basemaps.show(baseStyle);
    context.facade.baseStyle = baseStyle;
  }, [context, baseStyle]);

  // Leaflet adds its own classes to the map node. Keep that className stable:
  // React would overwrite those classes when switching the base map.
  return <div className={`territorial-leaflet-shell territorial-basemap-${baseStyle} ${props.mapContainerClassName || ''}`} style={props.mapContainerStyle}>
    <div ref={container} className="territorial-leaflet-map" />
    {context && <MapContext.Provider value={context}><BasemapAppearanceContext.Provider value={baseStyle}>{props.children}</BasemapAppearanceContext.Provider></MapContext.Provider>}
    {basemapStatus.loading && <div className="territorial-basemap-loading" role="status"><span aria-hidden="true" />Cargando {LEAFLET_BASEMAPS[baseStyle]?.label || 'mapa'}…</div>}
    {basemapStatus.error && <div className="territorial-tile-error" role="status">{basemapStatus.error} <button type="button" onClick={() => context?.basemaps.show(baseStyle, true)}>Reintentar</button></div>}
  </div>;
}

export function Polygon({ paths, options = {}, onClick, onMouseOver, onMouseOut }) {
  const context = useContext(MapContext);
  const appearance = useContext(BasemapAppearanceContext);
  const ref = useRef(null);
  const halo = useRef(null);
  const callbacks = useRef({ onClick, onMouseOver, onMouseOut });
  callbacks.current = { onClick, onMouseOver, onMouseOut };
  const fillColor = options.fillColor, fillOpacity = options.fillOpacity ?? .3;
  const strokeColor = options.strokeColor, strokeWeight = options.strokeWeight ?? 1;
  const strokeOpacity = options.strokeOpacity ?? 1, zIndex = options.zIndex || 0;
  const coordinates = useMemo(() => Array.isArray(paths[0]) ? paths.map(ring => ring.map(asLeafletCoordinate)) : paths.map(asLeafletCoordinate), [paths]);
  useEffect(() => {
    if (!context?.active) return;
    const layer = L.polygon(coordinates, {
      interactive: options.clickable !== false, bubblingMouseEvents: false,
    }).addTo(context.map);
    layer.on('click', e => callbacks.current.onClick?.(translateMapEvent(e)));
    layer.on('mouseover', e => callbacks.current.onMouseOver?.(translateMapEvent(e)));
    layer.on('mouseout', e => callbacks.current.onMouseOut?.(translateMapEvent(e)));
    ref.current = layer;
    context.vectors.add(layer);
    return () => {
      context.vectors.delete(layer); layer.remove(); ref.current = null;
      if (halo.current) { context.vectors.delete(halo.current); halo.current.remove(); halo.current = null; }
    };
  }, [context, coordinates, options.clickable]);
  useEffect(() => {
    if (!context?.active || !ref.current || !context.map.hasLayer(ref.current)) return;
    const opacityScale = appearance === 'oscuro' ? .45 : appearance === 'satelite' ? .6 : appearance === 'minimal' ? .9 : .72;
    ref.current.setStyle({
      fillColor, fillOpacity: fillOpacity * opacityScale, color: strokeColor, weight: strokeWeight, opacity: strokeOpacity,
    });
    ref.current.territorialZ = zIndex;
    if (['oscuro', 'satelite'].includes(appearance) && strokeWeight > 0 && strokeOpacity > 0) {
      if (!halo.current) {
        halo.current = L.polygon(coordinates, { fill: false, interactive: false }).addTo(context.map);
        context.vectors.add(halo.current);
      }
      halo.current.setStyle({ color: '#fff', weight: strokeWeight + 1.8, opacity: strokeOpacity * .42 });
      halo.current.territorialZ = zIndex - .1;
    } else if (halo.current) {
      context.vectors.delete(halo.current); halo.current.remove(); halo.current = null;
    }
    context.reorder();
  }, [context, coordinates, appearance, fillColor, fillOpacity, strokeColor, strokeWeight, strokeOpacity, zIndex]);
  return null;
}

export function OverlayView({ position, mapPaneName, children }) {
  const context = useContext(MapContext);
  const host = useMemo(() => document.createElement('div'), []);
  const marker = useRef(null);
  const latestPosition = useRef(position);
  latestPosition.current = position;
  useEffect(() => {
    if (!context?.active) return;
    const layer = L.marker(asLeafletCoordinate(latestPosition.current), {
      pane: mapPaneName === 'floatPane' ? 'territorialCards' : 'territorialLabels',
      icon: L.divIcon({ html: host, className: 'territorial-leaflet-overlay', iconSize: [0, 0], iconAnchor: [0, 0] }),
      interactive: false, keyboard: false,
    }).addTo(context.map);
    marker.current = layer;
    L.DomEvent.disableClickPropagation(host);
    L.DomEvent.disableScrollPropagation(host);
    return () => { layer.remove(); marker.current = null; };
  }, [context, host, mapPaneName]);
  useEffect(() => { if (context?.active) marker.current?.setLatLng(asLeafletCoordinate(position)); }, [context, position]);
  return createPortal(children, host);
}

export function createMarkerIcon(icon = {}) {
  if (icon.url) return L.icon({
    iconUrl: icon.url,
    iconSize: icon.scaledSize ? [icon.scaledSize.width, icon.scaledSize.height] : [34, 44],
    iconAnchor: icon.anchor ? [icon.anchor.x, icon.anchor.y] : [17, 43],
  });
  const radius = icon.scale || 7;
  const weight = icon.strokeWeight ?? 2;
  const size = (radius + weight) * 2;
  // DOM styles, not interpolated HTML: marker colors never become markup.
  const dot = document.createElement('span');
  Object.assign(dot.style, {
    display: 'block', boxSizing: 'border-box', width: `${size}px`, height: `${size}px`,
    borderRadius: '50%', backgroundColor: icon.fillColor || '#7B1528',
    opacity: String(icon.fillOpacity ?? 1), border: `${weight}px solid ${icon.strokeColor || '#fff'}`,
  });
  return L.divIcon({ html: dot, className: 'territorial-leaflet-pin', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export function Marker({ position, icon, draggable = false, zIndex = 0, onClick, onDragEnd }) {
  const context = useContext(MapContext);
  const ref = useRef(null);
  const coordinate = asLeafletCoordinate(position);
  const iconKey = JSON.stringify(icon || {});
  const markerIcon = useMemo(() => createMarkerIcon(JSON.parse(iconKey)), [iconKey]);
  const callbacks = useRef({});
  callbacks.current = { onClick, onDragEnd, position, markerIcon, draggable, zIndex };
  useEffect(() => {
    if (!context?.active) return;
    const initial = callbacks.current;
    const layer = L.marker(asLeafletCoordinate(initial.position), {
      icon: initial.markerIcon, draggable: initial.draggable, zIndexOffset: initial.zIndex * 100,
      bubblingMouseEvents: false,
    }).addTo(context.map);
    layer.on('click', e => callbacks.current.onClick?.(translateMapEvent(e)));
    layer.on('dragend', () => callbacks.current.onDragEnd?.(translateMapEvent({ latlng: layer.getLatLng() })));
    ref.current = layer;
    return () => { layer.remove(); ref.current = null; };
  }, [context]);
  useEffect(() => {
    if (!context?.active || !ref.current) return;
    ref.current.setLatLng([coordinate.lat, coordinate.lng]);
  }, [context, coordinate.lat, coordinate.lng]);
  useEffect(() => { if (context?.active) ref.current?.setIcon(markerIcon); }, [context, markerIcon]);
  useEffect(() => { if (context?.active) ref.current?.setZIndexOffset(zIndex * 100); }, [context, zIndex]);
  useEffect(() => {
    if (!context?.active || !ref.current) return;
    if (draggable) ref.current.dragging.enable(); else ref.current.dragging.disable();
  }, [context, draggable]);
  return null;
}

export function InfoWindow({ position, children, onCloseClick }) {
  const context = useContext(MapContext);
  const host = useMemo(() => document.createElement('div'), []);
  const callback = useRef(onCloseClick);
  callback.current = onCloseClick;
  useEffect(() => {
    if (!context?.active) return;
    const popup = L.popup().setLatLng(asLeafletCoordinate(position)).setContent(host).openOn(context.map);
    const close = () => callback.current?.();
    popup.on('remove', close);
    return () => { popup.off('remove', close); popup.remove(); };
  }, [context, host, position]);
  return createPortal(children, host);
}
