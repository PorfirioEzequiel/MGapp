import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockFilters = jest.fn();
let mockExisting;
let mockUpdateResult;
const mockSM = { usuario: 'sm-prueba', nombre: 'SM PRUEBA', poligono: 2, seccion: 4251, ubt: 17 };
const mockClient = { from: () => {
  const query = { operation: 'load' };
  query.select = query.ilike = query.order = () => query;
  query.eq = (...args) => { mockFilters(...args); return query; };
  query.maybeSingle = () => { query.operation = 'lookup'; return query; };
  query.update = record => { query.operation = 'update'; mockUpdate(record); return query; };
  query.insert = records => { query.operation = 'insert'; mockInsert(records); return query; };
  query.then = (resolve, reject) => Promise.resolve(
    query.operation === 'lookup' ? { data: mockExisting, error: null } :
    query.operation === 'update' ? mockUpdateResult :
    query.operation === 'insert' ? { error: null } : { data: [mockSM], error: null }
  ).then(resolve, reject);
  return query;
} };
jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
const MoviladoresGestion = require('./MoviladoresGestion').default;

beforeEach(() => {
  jest.clearAllMocks();
  mockExisting = { id: 42, puesto: 'BENEFICIARIO' };
  mockUpdateResult = { data: [{ id: 42 }], error: null };
});

async function submitForm(interior = 'a2', capturista = 'Karina') {
  render(<MemoryRouter><MoviladoresGestion /></MemoryRouter>);
  if (capturista) fireEvent.click(screen.getByRole('radio', { name: capturista }));
  fireEvent.focus(screen.getByPlaceholderText('Buscar por nombre, sección o sector…'));
  fireEvent.click(await screen.findByRole('button', { name: /SM PRUEBA/ }));
  fillAndSubmit(interior);
}

function fillAndSubmit(interior = 'a2', curp = 'LORA900101MMCPZN09') {
  const fields = {
    'JUAN PABLO': 'ana', 'GARCÍA': 'lopez', 'LÓPEZ': 'ruiz',
    'GALO800101HMCRZN09': curp, '5512345678': '0123456789',
    '55000': '01234', 'CENTRO': 'centro nuevo', '12': '12b', 'A2': interior,
    'AV. PRINCIPAL': 'calle nueva', 'Notas adicionales sobre la movilizadora…': '  Nota nueva  ',
  };
  Object.entries(fields).forEach(([placeholder, value]) => {
    const input = screen.getByPlaceholderText(placeholder);
    // Sync React's value tracker after the native form reset before entering text again.
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value } });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar Movilizador' }));
}

test('convierte al beneficiario actualizando datos personales, domicilio y asignación en el mismo registro', async () => {
  await submitForm();
  expect(await screen.findByRole('status')).toHaveTextContent('actualizado de Beneficiario a Movilizador');
  expect(mockUpdate).toHaveBeenCalledWith({
    nombre: 'ANA', a_paterno: 'LOPEZ', a_materno: 'RUIZ', telefono_1: '0123456789',
    calle: 'CALLE NUEVA', col_loc: 'CENTRO NUEVO', c_p: '01234', n_ext_mz: '12B', n_int_lt: 'A2',
    puesto: 'MOVILIZADOR', movilizador: 'sm-prueba', poligono: 2, seccion: 4251, ubt: 17,
    status: 'ACTIVO', observaciones: 'Nota nueva', capturista: 'Karina',
  });
  expect(mockFilters).toHaveBeenCalledWith('id', 42);
  expect(mockFilters).toHaveBeenCalledWith('puesto', 'BENEFICIARIO');
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('usuario');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('ingreso_estructura');
  expect(screen.getByPlaceholderText('JUAN PABLO')).toHaveValue('');
  expect(screen.getByText('SM PRUEBA')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Karina' })).toBeChecked();
});

test('un registro nuevo conserva el flujo de inserción y todos sus datos', async () => {
  const startedAt = Date.now();
  mockExisting = null;
  await submitForm();
  expect(await screen.findByRole('status')).toHaveTextContent('registrado correctamente');
  expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
    usuario: 'LORA900101MMCPZN09', curp: 'LORA900101MMCPZN09',
    nombre: 'ANA', calle: 'CALLE NUEVA', c_p: '01234', n_int_lt: 'A2', capturista: 'Karina',
  })]);
  expect(mockUpdate).not.toHaveBeenCalled();
  const registeredAt = mockInsert.mock.calls[0][0][0].ingreso_estructura;
  expect(registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(new Date(registeredAt).getTime()).toBeGreaterThanOrEqual(startedAt);
  expect(new Date(registeredAt).getTime()).toBeLessThanOrEqual(Date.now());
  expect(screen.getByRole('radio', { name: 'Karina' })).toBeChecked();
});

test('sin capturista no guarda ni convierte registros', async () => {
  await submitForm('a2', '');
  expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona quién está capturando');
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
  expect(screen.getAllByRole('radio').map(radio => radio.value)).toEqual(['Mauricio', 'Porfirio', 'Karina', 'Paola', 'Lorena', 'Otro']);
});

test('Otro se guarda como capturista y permanece seleccionado', async () => {
  mockExisting = null;
  await submitForm('a2', 'Otro');
  expect(await screen.findByRole('status')).toHaveTextContent('registrado correctamente');
  expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ capturista: 'Otro' })]);
  expect(screen.getByRole('radio', { name: 'Otro' })).toBeChecked();
});

test('dos capturas consecutivas conservan el capturista sin volver a seleccionarlo', async () => {
  mockExisting = null;
  await submitForm();
  expect(await screen.findByRole('status')).toHaveTextContent('registrado correctamente');
  expect(mockInsert).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar Movilizador' })).toBeEnabled());
  fillAndSubmit('b3', 'GALO800101HMCRZN09');
  await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(2));
  expect(mockInsert.mock.calls.map(([records]) => records[0].capturista)).toEqual(['Karina', 'Karina']);
  expect(screen.getByRole('radio', { name: 'Karina' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Paola' }));
  expect(screen.getByRole('radio', { name: 'Paola' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Karina' })).not.toBeChecked();
});

test('una CURP con otro puesto sigue siendo rechazada sin actualizarla', async () => {
  mockExisting = { id: 42, puesto: 'SM' };
  await submitForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('ya está registrada');
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
});

test('al fallar la actualización conserva la captura y no anuncia éxito', async () => {
  mockUpdateResult = { data: null, error: { message: 'Conexión fallida' } };
  await submitForm('');
  expect(await screen.findByRole('alert')).toHaveTextContent('Error al actualizar');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar Movilizador' })).toBeEnabled());
  expect(mockUpdate.mock.calls[0][0].n_int_lt).toBe('');
  expect(screen.getByPlaceholderText('JUAN PABLO')).toHaveValue('ana');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('si el registro deja de ser beneficiario antes de actualizar no anuncia éxito ni inserta un duplicado', async () => {
  mockUpdateResult = { data: [], error: null };
  await submitForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el registro');
  expect(mockFilters).toHaveBeenCalledWith('puesto', 'BENEFICIARIO');
  expect(mockInsert).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('JUAN PABLO')).toHaveValue('ana');
});
