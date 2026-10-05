import L from 'leaflet';
import { createLeafletFacade, leafletRuntime } from './leafletRuntime';

const fakeMap = () => {
  const map = {
    getContainer: () => document.createElement('div'),
    getCenter: () => L.latLng(19.66, -98.99), getZoom: () => 12,
    fitBounds: jest.fn(), flyToBounds: jest.fn(), flyTo: jest.fn(), setView: jest.fn(), stop: jest.fn(),
    on: jest.fn(), off: jest.fn(),
  };
  map.on.mockReturnValue(map); map.off.mockReturnValue(map);
  return map;
};
const bounds = lat => new leafletRuntime.maps.LatLngBounds().extend({lat, lng:-99}).extend({lat:lat+.01,lng:-98.98});
beforeEach(() => { jest.useFakeTimers(); window.matchMedia = jest.fn(() => ({ matches: false })); });
afterEach(() => { jest.useRealTimers(); delete window.matchMedia; });

test('encuadra al montar y anima únicamente el último territorio solicitado en el mismo cuadro', () => {
  const map = fakeMap(); const facade = createLeafletFacade(map);
  facade.fitBounds(bounds(19.6), 32);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  facade.fitBounds(bounds(19.7), 20);
  const last = bounds(19.8);
  facade.fitBounds(last, {left:60,top:80,right:60,bottom:160});
  jest.advanceTimersByTime(20);
  expect(map.flyToBounds).toHaveBeenCalledTimes(1);
  expect(map.flyToBounds).toHaveBeenCalledWith(last.bounds, expect.objectContaining({paddingTopLeft:[60,80],paddingBottomRight:[60,160],animate:true}));
  facade._disposeNavigation();
});

test('une pan y zoom en un solo vuelo, conservando el zoom al repetir el punto', () => {
  const map = fakeMap(); const facade = createLeafletFacade(map);
  facade.panTo({lat:19.7,lng:-99.1}); facade.setZoom(18); facade.panTo({lat:19.7,lng:-99.1});
  jest.advanceTimersByTime(20);
  expect(map.flyTo).toHaveBeenCalledTimes(1);
  expect(map.flyTo).toHaveBeenCalledWith(L.latLng(19.7,-99.1),18,expect.objectContaining({duration:expect.any(Number)}));
  facade._disposeNavigation();
});

test('el movimiento reducido utiliza encuadre directo y conserva el destino', () => {
  window.matchMedia.mockReturnValue({matches:true});
  const map = fakeMap(); const facade = createLeafletFacade(map);
  facade.panTo({lat:19.7,lng:-99.1}); facade.setZoom(17);
  jest.advanceTimersByTime(20);
  expect(map.flyTo).not.toHaveBeenCalled();
  expect(map.setView).toHaveBeenCalledWith(L.latLng(19.7,-99.1),17,{animate:false});
  facade._disposeNavigation();
});

test('los gestos manuales y el desmontaje cancelan viajes pendientes', () => {
  const map = fakeMap(); const root = document.createElement('div'); map.getContainer = () => root;
  const facade = createLeafletFacade(map);
  facade.panTo({lat:19.7,lng:-99.1}); root.dispatchEvent(new Event('pointerdown'));
  jest.advanceTimersByTime(20); expect(map.flyTo).not.toHaveBeenCalled();
  facade.setZoom(18); facade._disposeNavigation();
  jest.advanceTimersByTime(20); expect(map.flyTo).not.toHaveBeenCalled();
});
