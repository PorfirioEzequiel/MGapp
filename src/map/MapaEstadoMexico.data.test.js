import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MapaEstadoMexico from './MapaEstadoMexico';
import { loadMapJson } from '../utils/loadMapJson';

jest.mock('./territorialMapProvider', () => ({
  ...jest.requireMock('@react-google-maps/api'),
  getMapRuntime: () => global.window.google, IS_LEAFLET: false,
}));
jest.mock('../utils/loadMapJson', () => ({ loadMapJson: jest.fn() }));
jest.mock('../supabase/client', () => ({ __esModule: true, default: {} }));
jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true }),
  GoogleMap: ({ children }) => <div>{children}</div>,
  Polygon: () => null,
  OverlayView: ({ children }) => <div>{children}</div>,
}));
beforeEach(() => {
  window.google = { maps: { ControlPosition: { RIGHT_CENTER: 1 } } };
  loadMapJson.mockImplementation(path => path === '/senado_2024_edomex.json'
    ? Promise.reject(new Error('No disponible')) : Promise.resolve(path === '/edomex_estado.json' ? {} : []));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { delete window.google; jest.restoreAllMocks(); });

test('una capa fallida se detiene y solo reintenta cuando se vuelve a activar', async () => {
  render(<MapaEstadoMexico />);
  const button = await screen.findByRole('button', { name: /Senaduría 2024/ });
  fireEvent.click(button);
  await screen.findByText('No se pudo cargar la capa de Senaduría 2024.');
  await act(async () => {});
  const calls = () => loadMapJson.mock.calls.filter(([path]) => path === '/senado_2024_edomex.json').length;
  expect(calls()).toBe(1);
  fireEvent.click(button);
  fireEvent.click(button);
  await act(async () => {});
  expect(calls()).toBe(2);
});
