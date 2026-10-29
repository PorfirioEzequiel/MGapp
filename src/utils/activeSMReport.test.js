import * as XLSX from 'xlsx';
import { buildActiveSMReport } from './buildActiveSMReport';
import { createActiveSMReportWorkbook, activeSMReportFilename } from './activeSMReport';

const sm = (id, fields = {}) => ({ id, puesto: 'SM', status: 'ACTIVO', poligono: 1, seccion: 4251, ubt: 'F4251-01', ...fields });
const fractions = [
  { sector: 2, seccion: 4252, fraccion: 'F4252-01' },
  { sector: 1, seccion: 4251, fraccion: 'F4251-02' },
  { sector: 1, seccion: 4251, fraccion: 'F4251-01' },
];

test('solo cuenta SM ACTIVO por asignación laboral, conserva ceros y no duplica catálogo', () => {
  const sheets = buildActiveSMReport({ fractions: [...fractions, fractions[2]], sms: [
    sm(1, { latitud: 99, longitud: 99 }), sm(2, { seccion: '04251', ubt: ' f4251-01 ' }),
    sm(3, { status: 'ELIMINADO' }), sm(4, { status: 'SOLICITUD DE ALTA' }),
    sm(5, { status: 'RECHAZADA' }), sm(6, { status: null }), sm(7, { puesto: 'MOVILIZADOR' }),
    sm(8, { poligono: 2, seccion: 4252, ubt: 'F4252-01' }),
  ] });
  expect(sheets).toEqual([
    { name: 'Sector 1', rows: [[1, 4251, 'F4251-01', 2, ''], [1, 4251, 'F4251-02', 0, '']] },
    { name: 'Sector 2', rows: [[2, 4252, 'F4252-01', 1, '']] },
  ]);
});

test('mantiene sin fracción, históricas y discrepancias de sector sin reasignarlas al catálogo', () => {
  const sheets = buildActiveSMReport({ fractions, sms: [
    sm(1, { ubt: null }), sm(2, { ubt: '' }),
    sm(3, { seccion: 4191, ubt: 'F4191-02' }),
    sm(4, { poligono: 2 }),
    sm(5, { poligono: null, seccion: null, ubt: null }),
  ] });
  expect(sheets[0].rows).toContainEqual([1, 4251, 'Sin fracción asignada', 2, 'Sin fracción asignada']);
  expect(sheets[0].rows).toContainEqual([1, 4191, 'F4191-02', 1, 'Fracción sin coincidencia en el catálogo']);
  expect(sheets[1].rows).toContainEqual([2, 4251, 'F4251-01', 1, 'Fracción sin coincidencia en el catálogo']);
  expect(sheets[2].name).toBe('Sin sector');
  expect(sheets[2].rows[0][4]).toContain('Sin sección asignada');
  expect(sheets.flatMap(s => s.rows).reduce((n, row) => n + row[3], 0)).toBe(5);
});

test('no produce un reporte engañoso si una paginación repite SM o hay identificadores inválidos', () => {
  expect(() => buildActiveSMReport({ fractions, sms: [sm(1), sm('1')] })).toThrow('SM repetida');
  expect(() => buildActiveSMReport({ fractions, sms: [sm(1, { poligono: 'inválido' })] })).toThrow('sector o sección inválido');
  expect(() => createActiveSMReportWorkbook([])).toThrow('No se encontraron');
});

test('Excel reúne todos los sectores en una hoja continua con conteos numéricos y filtros', () => {
  const sheets = buildActiveSMReport({ fractions, sms: [sm(1), sm(2, { ubt: '=1+1' })] });
  const workbook = createActiveSMReportWorkbook(sheets);
  const exported = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  expect(exported.SheetNames).toEqual(['SM activas']);
  exported.SheetNames.forEach(name => {
    const sheet = exported.Sheets[name];
    expect(sheet['!merges']).toBeUndefined();
    expect(sheet['!autofilter'].ref).toBe(sheet['!ref']);
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    expect(rows[0]).toEqual(['Sector', 'Sección', 'Fracción', 'SM activas', 'Observación']);
    rows.slice(1).forEach(row => expect(typeof row[3]).toBe('number'));
    Object.values(sheet).forEach(cell => expect(cell?.f).toBeUndefined());
  });
  const rows = XLSX.utils.sheet_to_json(exported.Sheets['SM activas'], { header: 1 });
  expect(rows.slice(1)).toEqual(sheets.flatMap(group => group.rows));
  expect(rows.slice(1).map(row => row[0])).toEqual([1, 1, 1, 2]);
  expect(rows.slice(1).reduce((total, row) => total + row[3], 0)).toBe(2);
  expect(XLSX.utils.sheet_to_json(exported.Sheets['SM activas']).find(r => r.Fracción === '=1+1')['SM activas']).toBe(1);
  expect(activeSMReportFilename(new Date('2026-10-30T02:00:00Z'))).toBe('sm_activas_2026-10-29.xlsx');
});
