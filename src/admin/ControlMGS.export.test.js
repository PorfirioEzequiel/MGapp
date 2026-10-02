import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx';

const mockMovs = [
  { id: 1, movilizador: 'sm2', nombre: 'LUISA', a_paterno: 'PÉREZ' },
  { id: 2, movilizador: 'sm1', nombre: 'ANA', a_paterno: 'LÓPEZ', a_materno: 'RUIZ',
    curp: 'LORA900101MMCPZN09', telefono_1: '0123456789', calle: 'AV. PRINCIPAL',
    col_loc: 'CENTRO', c_p: '01234', n_ext_mz: 'S/N', n_int_lt: 'A2', observaciones: 'Nota de captura',
    ingreso_estructura: '2026-10-02T02:30:45+00:00', capturista: 'Karina' },
  { id: 3, movilizador: 'sm2', nombre: 'FECHA INVÁLIDA', ingreso_estructura: 'no-es-fecha' },
];
const mockSelect = jest.fn();
const mockClient = { from: table => {
  const query = { puesto: '' };
  query.select = fields => { mockSelect(table, fields); return query; };
  query.ilike = (field, value) => { query.puesto = value; return query; };
  query.eq = query.order = () => query;
  query.then = (resolve, reject) => Promise.resolve({ error: null, data:
    table === 'ubt_catalogo' ? [{ seccion: 4251, fraccion: 1 }, { seccion: 4252, fraccion: 2 }] :
    table === 'secciones' ? [{ seccion: 4251, pologono: 1 }, { seccion: 4252, pologono: 2 }] :
    query.puesto === 'movilizador' ? mockMovs : [
      { usuario: 'sm1', nombre: 'SM UNO', seccion: 4251, poligono: 1, ubt: 1 },
      { usuario: 'sm2', nombre: 'SM DOS', seccion: 4252, poligono: 2, ubt: 2 },
    ],
  }).then(resolve, reject);
  return query;
} };
jest.mock('../supabase/client', () => ({ supabaseStorage: mockClient }));
jest.mock('xlsx', () => ({ ...jest.requireActual('xlsx'), writeFile: jest.fn() }));
const ControlMGS = require('./ControlMGS').default;

test('el botón exporta los datos capturados completos y conserva texto y orden territorial', async () => {
  render(<MemoryRouter><ControlMGS /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '2027' } });
  const buttons = await screen.findAllByTitle('Descargar reporte Excel');
  fireEvent.click(buttons[0]);
  const [workbook, filename] = XLSX.writeFile.mock.calls[0];
  expect(filename).toMatch(/^Control_MGS_.*\.xlsx$/);
  const encoded = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const sheet = XLSX.read(encoded, { type: 'array' }).Sheets['Control MGS'];
  const rows = XLSX.utils.sheet_to_json(sheet);
  expect(rows[0]).toMatchObject({
    'Sector / SP': 'Sector 1', 'Sección': 4251, 'Fracción': 1, 'SM': 'SM UNO',
    'MGS': 'ANA LÓPEZ RUIZ', 'Nombre(s)': 'ANA', 'Apellido paterno': 'LÓPEZ',
    'Apellido materno': 'RUIZ', 'CURP': 'LORA900101MMCPZN09', 'Teléfono': '0123456789',
    'Calle': 'AV. PRINCIPAL', 'Colonia / localidad': 'CENTRO', 'Código postal': '01234',
    'Número exterior / manzana': 'S/N', 'Número interior / lote': 'A2', 'Observaciones': 'Nota de captura',
    'Fecha de ingreso a estructura (CDMX)': '01/10/2026 20:30',
    'Capturista': 'Karina',
  });
  expect(rows[1]).toMatchObject({ 'MGS': 'LUISA PÉREZ', 'Código postal': '', 'Teléfono': '' });
  expect(rows[1]['Fecha de ingreso a estructura (CDMX)']).toBe('');
  expect(rows[2]['Fecha de ingreso a estructura (CDMX)']).toBe('');
  expect(rows[1]['Capturista']).toBe('');
  expect(sheet['J2'].t).toBe('s');
  expect(sheet['M2'].t).toBe('s');
  const fields = mockSelect.mock.calls.find(([, value]) => value.includes('movilizador'))[1].split(', ');
  expect(fields).toEqual(expect.arrayContaining(['calle', 'col_loc', 'c_p', 'n_ext_mz', 'n_int_lt', 'ingreso_estructura', 'capturista']));
  expect(fields).not.toContain('created_at');
});
