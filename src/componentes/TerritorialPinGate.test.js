import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TerritorialPinGate from './TerritorialPinGate';

const renderGate = (puesto) => {
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'prueba', puesto }));
  return render(
    <MemoryRouter initialEntries={['/tablero']}>
      <Routes>
        <Route path="/" element={<div>Inicio</div>} />
        <Route path="/tablero" element={<TerritorialPinGate><div>Mapa completo</div></TerritorialPinGate>} />
      </Routes>
    </MemoryRouter>
  );
};

afterEach(() => sessionStorage.clear());

test.each(['administrador', 'master'])('%s debe ingresar el PIN antes de ver el mapa', (puesto) => {
  renderGate(puesto);
  expect(screen.queryByText('Mapa completo')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '0000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar al mapa' }));
  expect(screen.getByRole('alert')).toHaveTextContent('PIN incorrecto');
  expect(screen.queryByText('Mapa completo')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '2027' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar al mapa' }));
  expect(screen.getByText('Mapa completo')).toBeInTheDocument();
});

test('otro rol no puede abrir el mapa completo', () => {
  renderGate('consultor');
  expect(screen.getByText('Inicio')).toBeInTheDocument();
  expect(screen.queryByText('Mapa completo')).not.toBeInTheDocument();
});


test('la transición muestra carga mientras el mapa ya está montado y se retira', () => {
  jest.useFakeTimers();
  renderGate('administrador');
  fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '2027' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar al mapa' }));
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo el mapa');
  expect(screen.getByText('Mapa completo')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(2999));
  expect(screen.getByRole('status')).toHaveTextContent('Abriendo el mapa');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  jest.useRealTimers();
});
