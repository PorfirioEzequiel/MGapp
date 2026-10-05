import React from 'react';
import { act, render, screen } from '@testing-library/react';
import L from 'leaflet';
import { GoogleMap, Polygon, Marker, OverlayView } from './LeafletMapAdapter';
import { createLeafletFacade, leafletRuntime } from './leafletRuntime';
import { installPolygonMousePan } from './polygonMousePan';

jest.mock('./territorialMapConfig', () => {
  const actual = jest.requireActual('./territorialMapConfig');
  return { ...actual, LEAFLET_BASEMAPS: Object.fromEntries(Object.entries(actual.LEAFLET_BASEMAPS).map(([key, value]) => [key, { ...value, vectorStyle: null }])) };
});

let facade;
const ring = [{ lat: 19.65, lng: -99.0 }, { lat: 19.67, lng: -99.0 }, { lat: 19.67, lng: -98.98 }];
const center = { lat: 19.66, lng: -98.99 };
beforeEach(() => { jest.useFakeTimers(); });
beforeAll(() => {
  // Real Leaflet, using SVG in jsdom (which has no canvas implementation).
  L.Browser.svg = true; L.Browser.canvas = false;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
});
afterEach(() => { facade = null; jest.useRealTimers(); delete window.matchMedia; });

test('selección, hover, marcadores y edición conservan los callbacks y coordenadas', () => {
  const select = jest.fn(), hover = jest.fn(), click = jest.fn(), drag = jest.fn();
  const { unmount } = render(<GoogleMap center={center} zoom={12} onLoad={map => { facade = map; }}>
    <Polygon paths={ring} options={{ clickable: true, fillColor: '#7B1528', zIndex: 20 }} onClick={select} onMouseOver={hover} />
    <Marker position={center} draggable icon={{ scale: 10 }} onClick={click} onDragEnd={drag} />
    <OverlayView position={center}><span>Sección de prueba</span></OverlayView>
  </GoogleMap>);
  let polygon, marker;
  facade._leaflet.eachLayer(layer => {
    if (layer instanceof L.Polygon) polygon = layer;
    if (layer instanceof L.Marker && layer.options.draggable) marker = layer;
  });
  act(() => {
    polygon.fire('click', { latlng: L.latLng(center.lat, center.lng) });
    polygon.fire('mouseover');
    marker.fire('click', { latlng: marker.getLatLng() });
    marker.setLatLng([19.7, -99.1]); marker.fire('dragend');
  });
  expect(select).toHaveBeenCalledTimes(1);
  expect(hover).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledTimes(1);
  expect(drag.mock.calls[0][0].latLng.lat()).toBe(19.7);
  expect(drag.mock.calls[0][0].latLng.lng()).toBe(-99.1);
  expect(screen.getByText('Sección de prueba')).toBeInTheDocument();
  expect(facade._leaflet.dragging.enabled()).toBe(true);
  expect(facade._leaflet.touchZoom.enabled()).toBe(true);
  expect(polygon.options.bubblingMouseEvents).toBe(false);
  expect(marker.options.bubblingMouseEvents).toBe(false);
  const map = facade._leaflet;
  unmount();
  expect(map._container._leaflet_id).toBeUndefined();
});

test('cambiar mapa base y datos no recrea el mapa ni reinicia el encuadre', () => {
  window.matchMedia = () => ({ matches: true });
  const loaded = jest.fn(map => { facade = map; });
  const view = style => <GoogleMap center={center} zoom={12} baseStyle={style} onLoad={loaded}>
    <Polygon paths={ring} options={{ clickable: false }} />
  </GoogleMap>;
  const { rerender } = render(view('claro'));
  const original = facade._leaflet;
  act(() => facade.setCenter({ lat: 19.7, lng: -99.1 }));
  act(() => jest.advanceTimersByTime(1100));
  rerender(view('satelite'));
  expect(loaded).toHaveBeenCalledTimes(1);
  expect(facade._leaflet).toBe(original);
  expect(original.getContainer()).toHaveClass('leaflet-container');
  expect(facade.getCenter().lat()).toBeCloseTo(19.7);
  const urls = [];
  original.eachLayer(layer => { if (layer instanceof L.TileLayer) urls.push(layer._url); });
  expect(urls).toHaveLength(3);
  expect(urls.some(url => url.includes('World_Imagery'))).toBe(true);
  let background;
  original.eachLayer(layer => { if (layer instanceof L.Polygon) background = layer; });
  expect(background.options.interactive).toBe(false);
  rerender(view('minimal'));
  const grayLayers = [];
  original.eachLayer(layer => { if (layer instanceof L.TileLayer) grayLayers.push(layer); });
  expect(original.getContainer()).toHaveClass('leaflet-container');
  expect(grayLayers).toHaveLength(2);
  expect(grayLayers.every(layer => layer.options.maxNativeZoom === 16)).toBe(true);
  expect(grayLayers.some(layer => layer._url.includes('World_Light_Gray_Reference'))).toBe(true);
});

test('el evento del fondo sigue entregando latLng y los límites aceptan padding asimétrico', () => {
  const clicked = jest.fn();
  render(<GoogleMap center={center} zoom={12} onLoad={map => { facade = map; }} onClick={clicked} />);
  act(() => facade._leaflet.fire('click', { latlng: L.latLng(19.6, -99) }));
  expect(clicked.mock.calls[0][0].latLng.lat()).toBe(19.6);
  const bounds = new leafletRuntime.maps.LatLngBounds();
  bounds.extend(ring[0]).extend(ring[1]);
  const fit = jest.fn();
  createLeafletFacade({ fitBounds: fit }).fitBounds(bounds, { top: 80, right: 60, bottom: 160, left: 60 });
  expect(fit.mock.calls[0][1]).toMatchObject({ paddingTopLeft: [60, 80], paddingBottomRight: [60, 160] });
});

test('el arreglo de arrastre de Google nunca intercepta el canvas de Leaflet', () => {
  const getDiv = jest.fn();
  installPolygonMousePan({ provider: 'leaflet', getDiv }).cleanup();
  expect(getDiv).not.toHaveBeenCalled();
});

test('muestra un error del mapa base sin quitar polígonos o etiquetas', () => {
  render(<GoogleMap center={center} zoom={12} onLoad={map => { facade = map; }}>
    <OverlayView position={center}><span>Datos territoriales</span></OverlayView>
  </GoogleMap>);
  act(() => facade._leaflet.eachLayer(layer => { if (layer instanceof L.TileLayer) layer.fire('tileerror'); }));
  expect(screen.getByRole('status')).toHaveTextContent('tus capas siguen disponibles');
  expect(screen.getByText('Datos territoriales')).toBeInTheDocument();
});

test('el montaje estricto puede cerrar y reconstruir el mapa sin reutilizar capas cerradas', () => {
  const { unmount } = render(<React.StrictMode>
    <GoogleMap center={center} zoom={12} onLoad={map => { facade = map; }}>
      <Polygon paths={ring} />
      <OverlayView position={center}><span>Etiqueta vigente</span></OverlayView>
      <Marker position={center} icon={{ scale: 7 }} />
    </GoogleMap>
  </React.StrictMode>);
  expect(screen.getByText('Etiqueta vigente')).toBeInTheDocument();
  expect(facade._leaflet.dragging.enabled()).toBe(true);
  unmount();
});

test('conserva el fondo cargado hasta completar todas las referencias del satélite', () => {
  const view = style => <GoogleMap center={center} zoom={12} baseStyle={style} onLoad={map => { facade = map; }}>
    <Polygon paths={ring} />
  </GoogleMap>;
  const { rerender } = render(view('claro'));
  const map = facade._leaflet;
  const tiles = () => {
    const layers = [];
    map.eachLayer(layer => { if (layer instanceof L.TileLayer) layers.push(layer); });
    return layers;
  };
  const previous = tiles()[0];
  act(() => previous.fire('load'));
  rerender(view('satelite'));
  const incoming = tiles().filter(layer => layer !== previous);
  expect(map.hasLayer(previous)).toBe(true);
  expect(incoming).toHaveLength(3);
  act(() => { incoming[0].fire('load'); incoming[1].fire('load'); jest.advanceTimersByTime(300); });
  expect(map.hasLayer(previous)).toBe(true);
  act(() => { incoming[2].fire('load'); jest.advanceTimersByTime(221); });
  expect(map.hasLayer(previous)).toBe(false);
  expect(incoming.every(layer => map.hasLayer(layer))).toBe(true);
});

test('un fondo fallido o cancelado no retira la cartografía anterior ni los datos', () => {
  const view = style => <GoogleMap center={center} zoom={12} baseStyle={style} onLoad={map => { facade = map; }}>
    <OverlayView position={center}><span>Datos conservados</span></OverlayView>
  </GoogleMap>;
  const { rerender } = render(view('claro'));
  const map = facade._leaflet;
  const tiles = () => {
    const layers = [];
    map.eachLayer(layer => { if (layer instanceof L.TileLayer) layers.push(layer); });
    return layers;
  };
  const previous = tiles()[0];
  act(() => previous.fire('load'));
  rerender(view('satelite'));
  const failed = tiles().find(layer => layer !== previous);
  act(() => failed.fire('tileerror'));
  expect(screen.getByRole('status')).toHaveTextContent('Se conserva la vista Claro');
  expect(map.hasLayer(previous)).toBe(true);
  expect(map.hasLayer(failed)).toBe(false);
  rerender(view('minimal'));
  const cancelled = tiles().filter(layer => layer !== previous);
  rerender(view('claro'));
  act(() => { cancelled.forEach(layer => layer.fire('load')); jest.advanceTimersByTime(16000); });
  expect(tiles()).toEqual([previous]);
  expect(screen.getByText('Datos conservados')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('hover del padre no reconstruye los pines ni restiliza geometrías sin cambios', () => {
  const view = () => <GoogleMap center={center} zoom={12} onLoad={map => { facade = map; }}>
    <Polygon paths={ring} options={{ fillColor: '#7B1528', fillOpacity: .5, strokeColor: '#000', zIndex: 2 }} />
    <Marker position={{ ...center }} icon={{ fillColor: '#7B1528', scale: 8 }} />
  </GoogleMap>;
  const { rerender } = render(view());
  let polygon, marker;
  facade._leaflet.eachLayer(layer => {
    if (layer instanceof L.Polygon) polygon = layer;
    if (layer instanceof L.Marker) marker = layer;
  });
  const setStyle = jest.spyOn(polygon, 'setStyle');
  const setIcon = jest.spyOn(marker, 'setIcon');
  rerender(view());
  expect(setStyle).not.toHaveBeenCalled();
  expect(setIcon).not.toHaveBeenCalled();
});
