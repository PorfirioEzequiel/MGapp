import React from 'react';
import { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPending = {};
const mockSections = [4251, 4252].map((seccion, index) => ({ seccion, pologono: index + 1, distrito_federal: 5, lista_nominal: 100 }));
const mockQueries = [];
let mockSMRows = [];
let mockCatalog = [];
let mockSMError = null;
const mockClient = { from: table => {
  const query = { table, filters: {}, fields: '' };
  for (const method of ['select', 'eq', 'or', 'not', 'order', 'in', 'maybeSingle', 'abortSignal']) {
    query[method] = (...args) => {
      if (method === 'select') query.fields = args[0];
      if (method === 'eq') query.filters[args[0]] = args[1];
      if (method === 'or') query.orFilter = args[0];
      if (method === 'in') query.inFilter = args;
      return query;
    };
  }
  query.then = (resolve, reject) => {
    mockQueries.push(query);
    if (table === 'ciudadania' && query.filters.seccion && query.filters.puesto !== 'SM' && query.fields.startsWith('id, nombre')) {
      return mockPending[query.filters.seccion].promise.then(resolve, reject);
    }
    let data = [];
    let error = null;
    if (table === 'secciones') data = mockSections;
    if (table === 'ciudadania' && query.filters.puesto === 'SM') {
      data = mockSMRows.filter(row => !query.filters.seccion || Number(row.seccion) === query.filters.seccion);
      error = mockSMError;
    }
    if (table === 'ubt_catalogo') data = mockCatalog.filter(row => !query.filters.seccion || row.seccion === query.filters.seccion);
    return Promise.resolve({ data, count: 0, error }).then(resolve, reject);
  };
  return query;
} };
jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
jest.mock('../utils/loadMapJson', () => ({ loadMapJson: jest.fn(async () => []) }));
jest.mock('../utils/backendFetch', () => ({ backendFetch: jest.fn(async () => null) }));
jest.mock('../map/MapaEstadoMexico', () => () => null);
jest.mock('../map/MapTerritorial', () => ({ ciudadanos, onSelectSeccion, focusCoords, fraccionesGeo }) => (
  <div>
    {mockSections.map(section => <button key={section.seccion} onClick={() => onSelectSeccion(section)}>Abrir {section.seccion}</button>)}
    <div data-testid="pins">{ciudadanos.map(c => c.nombre).join(',')}</div>
    <div data-testid="focused-sm">{focusCoords?.name}</div>
    <div data-testid="fraction-sm">{fraccionesGeo.map(f => f.sm?.nombre).join(',')}</div>
  </div>
));
const TableroBoard = require('./TableroBoard').default;
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
beforeEach(() => {
  mockSMRows = []; mockCatalog = []; mockSMError = null; mockQueries.length = 0;
  require('../utils/loadMapJson').loadMapJson.mockResolvedValue([]);
  require('../utils/backendFetch').backendFetch.mockResolvedValue(null);
  mockPending[4251] = deferred(); mockPending[4252] = deferred();
  sessionStorage.setItem('user', JSON.stringify({ puesto: 'administrador' }));
});

const smCount = () => screen.getByText('SMs', { selector: '.territorial-stat-card p' }).parentElement;
const finishSection = async (seccion = 4251) => {
  await act(async () => { mockPending[seccion].resolve({ data: [], error: null }); });
  await screen.findByText('Fracciones y promotores SM');
};
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

test('los totales incluyen todos los estatus y las históricas en municipio, distrito y sector', async () => {
  mockSMRows = [
    { seccion: '4251', poligono: 1, status: 'ACTIVO' },
    { seccion: '4251', poligono: 1, status: 'ELIMINADO' },
    { seccion: '4191', poligono: 1, status: 'SOLICITUD DE ALTA' },
    { seccion: '4252', poligono: 2, status: 'RECHAZADA' },
  ];
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Abrir 4251' });
  await waitFor(() => expect(within(smCount()).getByText('4')).toBeInTheDocument());
  expect(within(smCount()).getByText('registradas')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir 4251' }));
  await act(async () => { mockPending[4251].resolve({ data: [], error: null }); });
  await waitFor(() => expect(within(smCount()).getByText('2')).toBeInTheDocument());
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Ubicación territorial' })).getByRole('button', { name: 'Sector 1', exact: true }));
  await waitFor(() => expect(within(smCount()).getByText('3')).toBeInTheDocument());
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Ubicación territorial' })).getByRole('button', { name: 'Dto. 5', exact: true }));
  await waitFor(() => expect(within(smCount()).getByText('4')).toBeInTheDocument());
  expect(mockQueries.filter(q => q.table === 'ciudadania' && q.filters.puesto === 'SM').every(q => q.filters.status == null)).toBe(true);
  expect(screen.queryByText(/ELIMINADO|SOLICITUD DE ALTA|RECHAZADA/)).not.toBeInTheDocument();
});

test('muestra todas las SM de una fracción y permite seleccionar personas distintas', async () => {
  mockCatalog = [{ seccion: 4251, fraccion: 'F4251-01' }];
  mockSMRows = [
    { id: 1, nombre: 'Primera', a_paterno: 'SM', a_materno: 'Prueba', usuario: 'sm-one', seccion: '4251', poligono: 1, ubt: 'F4251-01', status: 'ELIMINADO', latitud: 19.7, longitud: -98.9 },
    { id: 2, nombre: 'Segunda', a_paterno: 'SM', a_materno: 'Prueba', usuario: 'sm-two', seccion: '4251', poligono: 1, ubt: 'F4251-01', status: 'ACTIVO', latitud: 19.8, longitud: -98.8 },
  ];
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir 4251' }));
  await finishSection();
  expect(screen.getByTestId('fraction-sm')).toHaveTextContent('Segunda');
  fireEvent.click(screen.getByRole('button', { name: 'Primera SM Prueba' }));
  expect(screen.getByTestId('focused-sm')).toHaveTextContent('Primera SM Prueba');
  fireEvent.click(screen.getByRole('button', { name: 'Segunda SM Prueba' }));
  expect(screen.getByTestId('focused-sm')).toHaveTextContent('Segunda SM Prueba');
  expect(screen.getByRole('button', { name: 'Cerrar ficha del SM' })).toBeInTheDocument();
  const movQuery = mockQueries.find(q => q.filters.puesto === 'MOVILIZADOR' && q.inFilter);
  expect(movQuery.filters.status).toBe('ACTIVO');
  expect(movQuery.inFilter).toEqual(['movilizador', ['sm-two']]);
  expect(mockQueries.filter(q => q.fields.startsWith('id, nombre') && q.filters.puesto !== 'SM').every(q => q.orFilter === 'status.eq.ACTIVO,puesto.eq.SM')).toBe(true);
  expect(screen.queryByText('ELIMINADO')).not.toBeInTheDocument();
});

test('las SM sin fracción aparecen y abren su ficha incluso si la sección no tiene catálogo', async () => {
  mockSMRows = [
    { id: 3, nombre: 'Sin fracción uno', a_paterno: '', a_materno: '', usuario: 'sm-three', seccion: '4251', poligono: 1, ubt: null },
    { id: 4, nombre: 'Sin fracción dos', a_paterno: '', a_materno: '', usuario: 'sm-four', seccion: '4251', poligono: 1, ubt: '' },
  ];
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir 4251' }));
  await act(async () => { mockPending[4251].resolve({ data: [], error: null }); });
  fireEvent.click(await screen.findByRole('button', { name: 'Sin fracción uno' }));
  expect(screen.getByRole('button', { name: 'Cerrar ficha del SM' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sin fracción dos' }));
  expect(document.querySelector('.territorial-sm-name')).toHaveTextContent('Sin fracción dos');
  expect(within(smCount()).getByText('2')).toBeInTheDocument();
  expect(screen.getAllByText('Sin fracción asignada')).toHaveLength(2);
});

test('muestra la fracción capturada que falta en catálogo sin inflar las fracciones oficiales', async () => {
  mockCatalog = [{ seccion: 4251, fraccion: 'F4251-01' }];
  mockSMRows = [{ id: 5, nombre: 'Referencia original', a_paterno: '', a_materno: '', seccion: '4251', poligono: 1, ubt: 'F4191-09' }];
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir 4251' }));
  await finishSection();
  expect(screen.getByRole('button', { name: 'Referencia original' })).toBeInTheDocument();
  expect(screen.getByText('F4191-09')).toBeInTheDocument();
  expect(screen.getByText('Sin coincidencia en catálogo')).toBeInTheDocument();
  const fractionCount = screen.getByText('Fracciones', { selector: '.territorial-stat-card p' }).parentElement;
  expect(within(fractionCount).getByText('1')).toBeInTheDocument();
  expect(screen.getByTestId('fraction-sm')).toHaveTextContent('');
});

test('un error en la consulta de SM no presenta cero como un conteo válido', async () => {
  mockSMError = { message: 'Network error' };
  render(<MemoryRouter><TableroBoard /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Abrir 4251' });
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el conteo de SM.');
  expect(within(smCount()).getByText('—')).toBeInTheDocument();
});
