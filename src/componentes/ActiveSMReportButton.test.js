import React from 'react';
import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as XLSX from 'xlsx';
import ActiveSMReportButton from './ActiveSMReportButton';

let mockSMs;
let mockError;
let mockGate;
const mockQueries = [];
jest.mock('../supabase/client', () => ({ supabaseStorage: { from: table => {
  const query = { table, filters: {}, rangeArgs: [] };
  ['select', 'eq', 'order', 'range'].forEach(method => {
    query[method] = (...args) => {
      if (method === 'eq') query.filters[args[0]] = args[1];
      if (method === 'range') query.rangeArgs = args;
      return query;
    };
  });
  query.then = (resolve, reject) => {
    mockQueries.push(query);
    const rows = table === 'ubt_catalogo' ? [{ sector: 1, seccion: 4251, fraccion: 'F4251-01' }]
      : mockSMs.filter(row => row.status === query.filters.status && row.puesto === query.filters.puesto);
    const [start, end] = query.rangeArgs;
    return Promise.resolve(mockGate).then(() => ({ data: rows.slice(start, end + 1), count: rows.length, error: mockError })).then(resolve, reject);
  };
  return query;
} } }));
jest.mock('xlsx', () => ({ ...jest.requireActual('xlsx'), writeFile: jest.fn() }));

beforeEach(() => {
  mockSMs = Array.from({ length: 1003 }, (_, id) => ({ id, puesto: 'SM', status: 'ACTIVO', poligono: 1, seccion: 4251, ubt: 'F4251-01' }));
  mockSMs.push({ id: 2000, puesto: 'SM', status: 'ELIMINADO', poligono: 1, seccion: 4251, ubt: 'F4251-01' });
  mockQueries.length = 0; mockError = null; mockGate = null; XLSX.writeFile.mockClear();
});

test('descarga todos los registros paginados y consulta otra vez en la siguiente descarga', async () => {
  const onError = jest.fn();
  render(<ActiveSMReportButton onError={onError} />);
  fireEvent.click(screen.getByRole('button', { name: 'SM activas por sector' }));
  await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
  const [workbook] = XLSX.writeFile.mock.calls[0];
  expect(workbook.SheetNames).toEqual(['SM activas']);
  expect(XLSX.utils.sheet_to_json(workbook.Sheets['SM activas'])[0]['SM activas']).toBe(1003);
  expect(mockQueries.filter(q => q.table === 'ciudadania').map(q => q.rangeArgs)).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  mockSMs = [];
  fireEvent.click(await screen.findByRole('button', { name: 'SM activas por sector' }));
  await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(2));
  expect(XLSX.utils.sheet_to_json(XLSX.writeFile.mock.calls[1][0].Sheets['SM activas'])[0]['SM activas']).toBe(0);
  expect(onError).toHaveBeenLastCalledWith(null);
});

test('bloquea dobles clics mientras carga y permite reintentar tras un error sin descargar datos incompletos', async () => {
  const onError = jest.fn();
  let release;
  mockGate = new Promise(resolve => { release = resolve; });
  mockError = { message: 'La consulta falló' };
  render(<ActiveSMReportButton onError={onError} />);
  const button = screen.getByRole('button', { name: 'SM activas por sector' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(button);
  await act(async () => release());
  expect(XLSX.writeFile).not.toHaveBeenCalled();
  expect(onError).toHaveBeenLastCalledWith('No se pudo exportar SM activas. La consulta falló');
  expect(button).toBeEnabled();
  mockError = null;
  fireEvent.click(button);
  await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledTimes(1));
});
