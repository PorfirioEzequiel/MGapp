import { render, screen } from '@testing-library/react';
import App from './App';

// La prueba de entrada no genera PDFs ni realiza consultas o escrituras reales.
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('./supabase/client', () => ({ __esModule: true, default: { from: jest.fn() }, supabaseStorage: { from: jest.fn() } }));

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => sessionStorage.clear());

test('la entrada pública muestra el inicio de sesión de MGapp', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Sistema de Monitoreo' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
});

test.each([null, '{sesión inválida'])('una ficha privada vuelve al inicio sin sesión válida: %s', session => {
  if (session) sessionStorage.setItem('user', session);
  window.history.replaceState({}, '', '/ciudadano/10');
  render(<App />);
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
