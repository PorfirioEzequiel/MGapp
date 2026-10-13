import React, { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockQueries = [];
let mockMobilizerError = false;
const mockSections = [{ seccion: 4251, pologono: 1 }, { seccion: 4252, pologono: 1 }];
const mockRows = {
  secciones: mockSections,
  ubt_catalogo: [{ seccion: 4251, sector: 1, fraccion: 'a' }, { seccion: 4251, sector: 1, fraccion: 'b' }, { seccion: 4252, sector: 1, fraccion: 'c' }],
  ciudadania: [
    { id: 1, usuario: 'sm1', nombre: 'SM uno', poligono: 1, seccion: 4251, puesto: 'SM', status: 'ACTIVO' },
    { id: 2, seccion: 4251, puesto: 'MOVILIZADOR', status: 'ACTIVO' },
    { id: 3, nombre: 'ANA', a_paterno: 'LÓPEZ', seccion: null, movilizador: 'sm1', puesto: 'MOVILIZADOR', status: 'ACTIVO', telefono_1: 'dato privado', curp: 'dato privado' },
    { id: 4, seccion: 4252, puesto: 'MOVILIZADOR', status: 'ACTIVO' },
    { id: 5, seccion: 4251, puesto: 'MOVILIZADOR', status: 'ELIMINADO' },
    { id: 6, seccion: 9999, puesto: 'MOVILIZADOR', status: 'ACTIVO' },
  ],
};
const mockClient = { from: table => {
  const query = { table, filters: {} };
  for (const method of ['select', 'eq', 'in', 'order', 'not', 'limit', 'range', 'abortSignal']) {
    query[method] = (...args) => {
      if (method === 'select') query.fields = args[0];
      if (method === 'eq') query.filters[args[0]] = args[1];
      if (method === 'in') query.inFilter = args;
      if (method === 'range') query.rangeArgs = args;
      return query;
    };
  }
  query.then = (resolve, reject) => {
    mockQueries.push(query);
    let data = (mockRows[table] || []).filter(row => Object.entries(query.filters).every(([field, value]) => String(row[field]) === String(value)));
    if (query.inFilter) data = data.filter(row => query.inFilter[1].some(value => String(value) === String(row[query.inFilter[0]])));
    const count = data.length;
    if (query.rangeArgs) data = data.slice(query.rangeArgs[0], query.rangeArgs[1] + 1);
    const error = mockMobilizerError && query.filters.puesto === 'MOVILIZADOR' ? { message: 'offline' } : null;
    return Promise.resolve({ data, count, error }).then(resolve, reject);
  };
  return query;
} };

jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
jest.mock('../utils/backendFetch', () => ({ backendFetch: async () => null }));
jest.mock('./ToggleStatusButtonCP', () => () => null);
jest.mock('../map/MapTerritorial', () => props => (
  <div>
    <div data-testid="mobilizer-layer">{JSON.stringify(props.movilizadoresBySec)}</div>
    <div data-testid="selected-section">{props.selectedSeccion}</div>
    <div data-testid="active-layer">{props.electoralModeExternal}</div>
    <button onClick={() => props.onElectoralModeChange('semaforo_mov')}>Capa MGS</button>
    <button onClick={() => props.onElectoralModeChange(null)}>Vista territorial</button>
    <button onClick={() => props.onElectoralModeChange('semaforo_cred')}>Capa credenciales</button>
  </div>
));
const Coordinador = require('./Coordinador').default;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

beforeEach(() => {
  mockQueries.length = 0;
  mockMobilizerError = false;
  global.fetch = jest.fn(async () => ({ json: async () => [] }));
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'sp1', puesto: 'sp', poligono: 1, nombre: 'SP prueba' }));
  window.innerWidth = 1024;
});
afterEach(() => sessionStorage.clear());
const open = () => render(<MemoryRouter initialEntries={['/coordinador/sp1']}>
  <Routes><Route path="/coordinador/:usuario" element={<Coordinador />} /></Routes>
</MemoryRouter>);

test.each([1024, 390])('Inicio y mapa muestran el mismo avance MGS del sector en ancho %i', async width => {
  window.innerWidth = width;
  open();
  const card = await screen.findByRole('region', { name: 'Avance de movilizadores' });
  await waitFor(() => expect(within(card).getByText('10.0%')).toBeInTheDocument());
  expect(within(card).getByText('30')).toBeInTheDocument();
  expect(within(card).getByText('3')).toBeInTheDocument();
  const smCard = screen.getByRole('region', { name: 'Movilizadores de SM uno' });
  expect(within(smCard).getByText('MOVILIZADORES')).toBeInTheDocument();
  expect(within(smCard).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 de 10 movilizadores');
  expect(within(smCard).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
  expect(within(smCard).queryByText('ANA LÓPEZ')).not.toBeInTheDocument();
  fireEvent.click(within(smCard).getByRole('button'));
  const dialog = screen.getByRole('dialog', { name: 'MOVILIZADORES' });
  expect(within(dialog).getByRole('listitem')).toHaveTextContent('ANA LÓPEZ');
  expect(within(dialog).queryByText('dato privado')).not.toBeInTheDocument();
  expect(smCard).not.toContainElement(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar lista de movilizadores' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Ver avance en el mapa' }));
  const report = await screen.findByRole('region', { name: 'Reporte de movilizadores' });
  expect(within(report).getByText('10.0%')).toBeInTheDocument();
  expect(screen.getByTestId('active-layer')).toHaveTextContent('semaforo_mov');
  expect(JSON.parse(screen.getByTestId('mobilizer-layer').textContent)).toEqual({
    4251: { count: 2, meta: 20, pct: 10 }, 4252: { count: 1, meta: 10, pct: 10 },
  });
  await act(async () => { fireEvent.click(within(report).getByRole('button', { name: /Sección 4252/ })); });
  expect(screen.getByTestId('selected-section')).toHaveTextContent('4252');
  expect(within(report).getByText('Sector 1 · Sección 4252')).toBeInTheDocument();
  expect(within(report).getByText('1')).toBeInTheDocument();
  fireEvent.click(within(report).getByRole('button', { name: 'Todo el sector' }));
  expect(screen.getByTestId('selected-section')).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole('button', { name: 'Vista territorial' }));
  expect(screen.queryByRole('region', { name: 'Reporte de movilizadores' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Capa credenciales' }));
  expect(screen.getByTestId('active-layer')).toHaveTextContent('semaforo_cred');
});

test('un error no aparece como cero y reintentar recupera la tarjeta y la capa', async () => {
  mockMobilizerError = true;
  open();
  const card = await screen.findByRole('region', { name: 'Avance de movilizadores' });
  expect(await within(card).findByRole('alert')).toHaveTextContent('No se pudo cargar');
  expect(within(card).queryByText('0.0%')).not.toBeInTheDocument();
  mockMobilizerError = false;
  fireEvent.click(within(card).getByRole('button', { name: 'Reintentar' }));
  expect(await within(card).findByText('10.0%')).toBeInTheDocument();
  expect(mockQueries.filter(query => query.filters.puesto === 'MOVILIZADOR').every(query => query.filters.status === 'ACTIVO')).toBe(true);
});
