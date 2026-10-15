import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let mockMarketRows;
const mockSections = [4251, 4252, 4253, 4254].map(seccion => ({ seccion, pologono: 1 }));
const mockClient = { from: table => {
  const query = { filters: {} };
  for (const method of ['select', 'eq', 'in', 'order', 'not', 'limit', 'range', 'abortSignal']) {
    query[method] = (...args) => {
      if (method === 'eq') query.filters[args[0]] = args[1];
      if (method === 'in') query.inFilter = args;
      if (method === 'range') query.rangeArgs = args;
      return query;
    };
  }
  query.then = (resolve, reject) => {
    const rows = table === 'secciones' ? mockSections : table === 'mercado' ? mockMarketRows
      : table === 'ubt_catalogo' ? mockSections.map(s => ({ seccion: s.seccion, sector: 1, fraccion: `F${s.seccion}-01` })) : [];
    let data = rows.filter(row => Object.entries(query.filters).every(([key, value]) => String(row[key]) === String(value)));
    if (query.inFilter) data = data.filter(row => query.inFilter[1].some(value => String(value) === String(row[query.inFilter[0]])));
    const count = data.length;
    if (query.rangeArgs) data = data.slice(query.rangeArgs[0], query.rangeArgs[1] + 1);
    return Promise.resolve({ data, count, error: null }).then(resolve, reject);
  };
  return query;
} };

jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
jest.mock('../utils/backendFetch', () => ({ backendFetch: async () => null }));
jest.mock('./ToggleStatusButtonCP', () => () => null);
jest.mock('../map/MapTerritorial', () => props => (
  <div>
    <div data-testid="market-data">{JSON.stringify(props.mercadoBySec)}</div>
    <div data-testid="base-style">{props.initialStyle}</div>
    <div data-testid="active-layer">{props.electoralModeExternal}</div>
    <div data-testid="selected-section">{props.selectedSeccion}</div>
    <button onClick={() => props.onElectoralModeChange('semaforo_mercado')}>Capa Mercado</button>
    <button onClick={() => props.onElectoralModeChange('semaforo_cred')}>Capa credenciales</button>
    <button onClick={() => props.onElectoralModeChange('semaforo_mov')}>Capa MGS</button>
    <button onClick={() => props.onElectoralModeChange('ayu_2021')}>Capa electoral</button>
    <button onClick={() => props.onElectoralModeChange(null)}>Vista territorial</button>
  </div>
));
const Coordinador = require('./Coordinador').default;

beforeEach(() => {
  mockMarketRows = [
    { seccion: 4251, sector: 1, total: 150, estatus: 'ENTREGADO' },
    { seccion: 4251, sector: 1, total: 100, estatus: 'ENTREGADO' },
    { seccion: 4251, sector: 1, total: 40, estatus: 'PENDIENTE' },
    { seccion: 4251, sector: 1, total: 10, estatus: 'PARCIAL' },
    { seccion: 4252, sector: 1, total: 100, estatus: 'ENTREGADO' },
    { seccion: 4253, sector: 1, total: 25, estatus: null },
  ];
  global.fetch = jest.fn(async () => ({ json: async () => [
    { seccion: 4252, morena: 100, pri: 50, mc: 10, ganador: 'MORENA', total_validos: 160 },
  ] }));
  sessionStorage.setItem('user', JSON.stringify({ usuario: 'sp1', puesto: 'sp', poligono: 1, nombre: 'SP prueba' }));
  window.innerWidth = 1024;
});
afterEach(() => sessionStorage.clear());
const openMap = async () => {
  render(<MemoryRouter initialEntries={['/coordinador/sp1']}><Routes>
    <Route path="/coordinador/:usuario" element={<Coordinador />} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /^Mapa$/ }));
  await screen.findByTestId('market-data');
};
const selectSection = async section => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: String(section), exact: true })); });
};
const marketData = () => JSON.parse(screen.getByTestId('market-data').textContent);

test.each([1024, 390])('Mercado abre con una sección seleccionada y conserva navegación y capas en ancho %i', async width => {
  window.innerWidth = width;
  await openMap();
  await waitFor(() => expect(marketData()[4251]?.total).toBe(300));
  await selectSection(4251);
  fireEvent.click(screen.getByRole('button', { name: 'Capa Mercado' }));
  expect(screen.getByText('Otros estatus')).toBeInTheDocument();
  expect(screen.getByText('Entregado').parentElement).toHaveTextContent(/2\s*registros/);
  expect(screen.getByText('Pendiente').parentElement).toHaveTextContent(/1\s*registros/);
  expect(screen.getByText('100.0%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Ver todo el sector' }));
  expect(screen.getByText('75.0%')).toBeInTheDocument();
  expect(screen.getByText('425')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Sección 4253.*25 pzas/ }));
  expect(screen.getByText('25.0%')).toBeInTheDocument();
  for (const [button, mode] of [['Capa credenciales', 'semaforo_cred'], ['Capa MGS', 'semaforo_mov'], ['Capa electoral', 'ayu_2021'], ['Vista territorial', '']]) {
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByTestId('active-layer').textContent).toBe(mode);
    expect(screen.getByTestId('selected-section')).toHaveTextContent('4253');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Capa Mercado' }));
  expect(screen.getByText('25.0%')).toBeInTheDocument();
});

test('el mapa de SP arranca en Claro', async () => {
  await openMap();
  expect(screen.getByTestId('base-style')).toHaveTextContent('claro');
});

test.each([[[0, 0]], [[10, 0]], [[0]]])('los totales %j no producen NaN ni cambian la referencia de la segunda sección', async totals => {
  mockMarketRows = totals.map((total, index) => ({ seccion: 4251 + index, sector: 1, total }));
  await openMap();
  await waitFor(() => expect(Object.keys(marketData())).toHaveLength(totals.length));
  const rates = Object.values(marketData()).map(row => row.deliveryRate);
  expect(rates).toEqual(totals.map(total => total > 0 ? 100 : 0));
  fireEvent.click(screen.getByRole('button', { name: 'Capa Mercado' }));
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
});

test('una sección sin registros informa la falta de datos y permite volver al sector', async () => {
  await openMap();
  fireEvent.click(screen.getByRole('button', { name: 'Capa Mercado' }));
  await selectSection(4254);
  expect(screen.getByText('Sin datos de Mercado Solidario para la sección 4254.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Ver todo el sector' }));
  expect(screen.getByText('75.0%')).toBeInTheDocument();
});

test('el panel móvil se coloca y responde al arrastre cada vez que se entra al mapa', async () => {
  window.innerWidth = 390;
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });
  const originalMatrix = global.DOMMatrix;
  global.DOMMatrix = class { constructor(transform) { this.m42 = Number(transform.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? 0); } };
  try {
    await openMap();
    for (let visit = 0; visit < 2; visit++) {
      const handle = screen.getByText('Mostrar más').closest('.cursor-grab');
      const sheet = handle.parentElement;
      expect(sheet.style.transform).toBe('translateY(716px)');
      fireEvent.touchStart(handle, { touches: [{ clientY: 700 }] });
      fireEvent.touchMove(handle, { touches: [{ clientY: 500 }] });
      expect(sheet.style.transform).toBe('translateY(516px)');
      fireEvent.touchMove(handle, { touches: [{ clientY: 700 }] });
      fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 700 }] });
      fireEvent.click(screen.getByRole('button', { name: /^Inicio$/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Mapa$/ }));
    }
  } finally {
    global.DOMMatrix = originalMatrix;
    if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height);
    else delete HTMLElement.prototype.clientHeight;
  }
});
