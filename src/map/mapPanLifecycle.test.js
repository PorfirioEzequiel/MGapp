import React, { act } from 'react';
import { render } from '@testing-library/react';
import MapTerritorial from './MapTerritorial';
import MapaEstadoMexico from './MapaEstadoMexico';
import { loadMapJson } from '../utils/loadMapJson';

const mockReplayEffects = [];
let mockMap;
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useEffect: (setup, deps) => actual.useEffect(() => {
      const effect = { setup, cleanup: setup() };
      if (typeof effect.cleanup !== 'function') return undefined;
      if (deps?.length === 0) mockReplayEffects.push(effect);
      return () => effect.cleanup();
    }, deps),
  };
});
jest.mock('./territorialMapProvider', () => ({
  ...jest.requireMock('@react-google-maps/api'),
  getMapRuntime: () => global.window.google, IS_LEAFLET: false,
}));
jest.mock('../utils/loadMapJson', () => ({ loadMapJson: jest.fn() }));
jest.mock('../supabase/client', () => ({ __esModule: true, default: {} }));
jest.mock('@react-google-maps/api', () => {
  const { Component } = jest.requireActual('react');
  return {
    useJsApiLoader: () => ({ isLoaded: true }),
    GoogleMap: class extends Component {
      componentDidMount() { this.props.onLoad(mockMap); }
      render() { return <div>{this.props.children}</div>; }
    },
    Polygon: () => null,
    Marker: () => null,
    OverlayView: ({ children }) => <div>{children}</div>,
    InfoWindow: () => null,
    Autocomplete: ({ children }) => <div>{children}</div>,
  };
});

let surface;
const mouse = (target, type, x, y, buttons = 1) => target.dispatchEvent(new MouseEvent(type,
  { bubbles: true, cancelable: true, button: 0, buttons, clientX: x, clientY: y }));
const drag = () => {
  mouse(surface, 'mousedown', 10, 10);
  mouse(document, 'mousemove', 40, 50);
  mouse(document, 'mouseup', 40, 50, 0);
};

beforeEach(() => {
  mockReplayEffects.length = 0;
  const root = document.createElement('div');
  root.innerHTML = '<div class="gm-style"><canvas /></div>';
  document.body.appendChild(root);
  surface = root.querySelector('canvas');
  window.google = { maps: {
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    LatLngBounds: class { extend() {} },
    ControlPosition: { RIGHT_CENTER: 1 },
    SymbolPath: { CIRCLE: 1 },
  } };
  mockMap = {
    getDiv: () => root, getZoom: () => 11, getCenter: () => ({}),
    getProjection: () => ({ fromLatLngToPoint: () => ({ x: 100, y: 100 }), fromPointToLatLng: p => p }),
    setCenter: jest.fn(), fitBounds: jest.fn(),
  };
  loadMapJson.mockImplementation(path => Promise.resolve(path === '/edomex_estado.json' ? {} : []));
});
afterEach(() => { mockMap.getDiv().remove(); delete window.google; });

test.each([
  ['Tecámac', () => <MapTerritorial secciones={[]} ciudadanos={[]} fraccionesGeo={[]} />],
  ['Estado de México', () => <MapaEstadoMexico />],
])('%s mantiene el arrastre al repetir los efectos sobre el mismo mapa', async (_, component) => {
  const { unmount } = render(component());
  await act(async () => {});
  drag();
  expect(mockMap.setCenter).toHaveBeenCalledTimes(1);
  mockMap.setCenter.mockClear();

  // Fast Refresh replays effect cleanup/setup without firing Google's onLoad again.
  await act(async () => {
    for (const effect of mockReplayEffects) effect.cleanup();
    for (const effect of mockReplayEffects) effect.cleanup = effect.setup();
  });
  drag();
  expect(mockMap.setCenter).toHaveBeenCalledTimes(1);

  unmount();
  mockMap.setCenter.mockClear();
  drag();
  expect(mockMap.setCenter).not.toHaveBeenCalled();
});
