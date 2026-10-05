import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LeafletAddressSearch from './LeafletAddressSearch';

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });

test('busca solo al pedirlo, no envía datos del ciudadano y selecciona coordenadas', async () => {
  const load = jest.fn(), changed = jest.fn();
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ features: [{
    properties: { osm_id: 1, name: 'Centro de Tecámac', countrycode: 'MX' }, geometry: { coordinates: [-98.99, 19.66] },
  }] }) });
  render(<LeafletAddressSearch onLoad={load} onPlaceChanged={changed}><input /></LeafletAddressSearch>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Centro de Tecámac' } });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Centro de Tecámac' }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(load.mock.calls[0][0].getPlace().geometry.location.lat()).toBe(19.66);
  expect(new URL(fetch.mock.calls[0][0]).searchParams.get('q')).toBe('Centro de Tecámac');
});

test('descarta resultados de una búsqueda anterior cuando cambia la dirección', async () => {
  let complete;
  global.fetch.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<LeafletAddressSearch><input /></LeafletAddressSearch>);
  // The first test's request is throttled; use a cached address to avoid it.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dirección anterior' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dirección nueva' } });
  await act(async () => complete({ ok: true, json: async () => ({ features: [{ properties: { name: 'Resultado anterior' }, geometry: { coordinates: [-99, 19] } }] }) }));
  expect(screen.queryByRole('button', { name: 'Resultado anterior' })).not.toBeInTheDocument();
});
