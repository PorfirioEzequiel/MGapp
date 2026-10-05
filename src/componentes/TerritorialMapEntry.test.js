import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TerritorialMapEntry from './TerritorialMapEntry';

const renderEntry = () => render(
  <MemoryRouter initialEntries={['/tablero']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<div>Inicio</div>} />
      <Route path="/tablero" element={<TerritorialMapEntry><div>Mapa completo</div></TerritorialMapEntry>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => { sessionStorage.clear(); jest.useRealTimers(); });

test.each(['administrador', 'master'])('%s abre el mapa directamente con el spinner de tres segundos', puesto => {
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'prueba', puesto }));
  renderEntry();
  expect(screen.queryByLabelText('PIN de acceso')).not.toBeInTheDocument();
  expect(screen.getByText('Mapa completo')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo el mapa');
  act(() => jest.advanceTimersByTime(2999));
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo el mapa');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('Mapa completo')).toBeInTheDocument();
});

test.each(['consultor', 'sp', 'captura'])('se conserva la restricción de acceso para el rol %s', puesto => {
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'prueba', puesto }));
  renderEntry();
  expect(screen.getByText('Inicio')).toBeInTheDocument();
  expect(screen.queryByText('Mapa completo')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test.each([null, '{sesion-invalida'])('una sesión ausente o corrupta regresa al inicio (%s)', session => {
  if (session != null) sessionStorage.setItem('user', session);
  renderEntry();
  expect(screen.getByText('Inicio')).toBeInTheDocument();
  expect(screen.queryByText('Mapa completo')).not.toBeInTheDocument();
});

test('salir durante la carga cancela el temporizador pendiente', () => {
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'prueba', puesto: 'administrador' }));
  const { unmount } = renderEntry();
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
