import React from 'react';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPending = {};
const mockSections = [4251, 4252].map(seccion => ({ seccion, pologono: 1, distrito_federal: 5, lista_nominal: 100 }));
const mockClient = { from: table => {
  const query = { filters: {}, fields: '' };
  for (const method of ['select', 'eq', 'not', 'order', 'in', 'maybeSingle', 'abortSignal']) {
    query[method] = (...args) => {
      if (method === 'select') query.fields = args[0];
      if (method === 'eq') query.filters[args[0]] = args[1];
      return query;
    };
  }
  query.then = (resolve, reject) => {
    if (table === 'ciudadania' && query.filters.seccion && query.fields.startsWith('id, nombre')) {
      return mockPending[query.filters.seccion].promise.then(resolve, reject);
    }
    return Promise.resolve({ data: table === 'secciones' ? mockSections : [], count: 0, error: null }).then(resolve, reject);
  };
  return query;
} };
jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
jest.mock('../utils/loadMapJson', () => ({ loadMapJson: jest.fn(async () => []) }));
jest.mock('../utils/backendFetch', () => ({ backendFetch: jest.fn(async () => null) }));
jest.mock('../map/MapaEstadoMexico', () => () => null);
jest.mock('../map/MapTerritorial', () => ({ ciudadanos, onSelectSeccion }) => (
  <div>
    {[4251, 4252].map(seccion => <button key={seccion} onClick={() => onSelectSeccion({ seccion, pologono: 1, distrito_federal: 5 })}>Abrir {seccion}</button>)}
    <div data-testid="pins">{ciudadanos.map(c => c.nombre).join(',')}</div>
  </div>
));
const TableroBoard = require('./TableroBoard').default;
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
beforeEach(() => {
  require('../utils/loadMapJson').loadMapJson.mockResolvedValue([]);
  require('../utils/backendFetch').backendFetch.mockResolvedValue(null);
  mockPending[4251] = deferred(); mockPending[4252] = deferred();
  sessionStorage.setItem('user', JSON.stringify({ puesto: 'administrador' }));
});
afterEach(() => sessionStorage.clear());

test('una respuesta de la sección anterior no reemplaza los pines de la sección actual', async () => {
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Abrir 4251' });
  expect(await screen.findByText(/Afiliación: usando respaldo local/)).toHaveTextContent('Comprobadas: no se pudo actualizar el conteo.');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir 4251' }));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir 4252' }));
  await act(async () => { mockPending[4252].resolve({ data: [{ nombre: 'Sección actual' }], error: null }); });
  expect(screen.getByTestId('pins')).toHaveTextContent('Sección actual');
  await act(async () => { mockPending[4251].resolve({ data: [{ nombre: 'Sección anterior' }], error: null }); });
  expect(screen.getByTestId('pins')).toHaveTextContent('Sección actual');
  expect(screen.getByTestId('pins')).not.toHaveTextContent('Sección anterior');
});
