import * as XLSX from 'xlsx';
import { adjustReportCredentials, buildTerritorialReport, createTerritorialReportWorkbook, CREDENTIAL_ADJUSTMENT_COLUMNS, GENERAL_REPORT_COLUMNS, readTerritorialRows, territorialReportFilename } from './territorialReport';

const fixture = () => ({
  sections: [{ seccion: 7001, pologono: 2 }, { seccion: 7002, pologono: 1 }, { seccion: 7002, pologono: 1 }],
  fractions: { 7001: 2, 7002: 1, 7003: 1 },
  sms: [
    { seccion: '7001', poligono: '2', latitud: '19.7', longitud: '-99.1', status: 'ELIMINADO' },
    { seccion: 7001, poligono: 2, latitud: '0', longitud: '-99.1' },
    { seccion: 7001, poligono: 2, latitud: '19.7', longitud: null },
    { seccion: 7001, poligono: 2, latitud: 'no es coordenada', longitud: '-99.1' },
    { seccion: 7002, poligono: 1, latitud: '19.7', longitud: '-99.1' },
    { seccion: 4191, poligono: 2 },
    { seccion: null, poligono: 2 },
  ],
  affiliation: { 7001: { sp: 2, entregadas_sp: 10, comprobadas: 12 }, 4191: { sp: 2, entregadas_sp: 4, comprobadas: 2 } },
  mobilizers: { 7001: 25, 4191: 3, 9999: 2 },
  unsectionedCredentials: { 2: 5 },
});

test('conserva todas las secciones y SM; coordenadas no cambian asignación, sin alias históricos', () => {
  const data = fixture();
  const rows = buildTerritorialReport(data);
  expect(rows.find(r => r[1] === 7001)).toEqual([2, 7001, 2, 4, 1, 3, 10, 12, 1.2, 20, 25, 1]);
  expect(rows.find(r => r[1] === 7002)[5]).toBe('');
  expect(rows.find(r => r[1] === 4191)).toEqual([2, 4191, 0, 1, 0, 1, 4, 2, 0.5, 0, 3, '']);
  expect(rows.find(r => r[1] === '')).toEqual([2, '', 0, 1, 0, 1, '', 5, '', 0, 0, '']);
  expect(rows.find(r => r[1] === 9999)[10]).toBe(2);
  expect(rows.reduce((sum, r) => sum + r[3], 0)).toBe(data.sms.length);
  expect(rows.reduce((sum, r) => sum + r[10], 0)).toBe(30);
  expect(rows.reduce((sum, r) => sum + Number(r[7]), 0)).toBe(19);
  rows.forEach(r => expect(r[4] + Number(r[5])).toBe(r[3]));
  expect(rows.filter(r => r[1] === 7002)).toHaveLength(1);
});

test('serializa el reporte ajustado y su aclaración con filtros, anchos y porcentajes numéricos', () => {
  const book = createTerritorialReportWorkbook(fixture());
  const encoded = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const read = XLSX.read(encoded, { type: 'array', cellStyles: true, cellNF: true });
  expect(read.SheetNames).toEqual(['Reporte general', 'Ajustes credenciales']);
  const sheet = read.Sheets['Reporte general'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  expect(rows[0]).toEqual(GENERAL_REPORT_COLUMNS);
  expect(rows.slice(1)).toEqual(adjustReportCredentials(buildTerritorialReport(fixture())).rows);
  expect(sheet['!merges']).toBeUndefined();
  expect(sheet['!autofilter'].ref).toBe(sheet['!ref']);
  expect(sheet['!cols']).toHaveLength(12);
  const row = rows.findIndex(r => r[1] === 7001) + 1;
  expect(sheet[`G${row}`]).toMatchObject({ t: 'n', v: 12, z: '#,##0' });
  expect(sheet[`I${row}`]).toMatchObject({ t: 'n', v: 1, z: '0.0%' });
  expect(sheet[`L${row}`]).toMatchObject({ t: 'n', v: 1, z: '0.0%' });
  const annex = read.Sheets['Ajustes credenciales'];
  const detail = XLSX.utils.sheet_to_json(annex, { header: 1, defval: '' });
  expect(detail[0]).toEqual(CREDENTIAL_ADJUSTMENT_COLUMNS);
  expect(detail.find(r => r[1] === 7001).slice(2, 9)).toEqual([10, 2, 12, 12, 0, 12, '']);
  expect(detail.find(r => r[1] === 4191).slice(2, 9)).toEqual([4, 0, 4, 2, 2, 4, '']);
  expect(detail.find(r => r[1] === 'Sin sección').slice(5, 9)).toEqual([5, '', 3, 3]);
  expect(annex['!merges']).toBeUndefined();
  expect(annex['!autofilter'].ref).toBe(annex['!ref']);
});

const credentialRow = (sector, section, delivered, checked) => [sector, section, 0, 0, 0, '', delivered, checked, '', 0, 0, ''];

test('reparte proporcionalmente al cupo del mismo sector, resuelve empates y conserva las fuentes', () => {
  const source = [
    credentialRow(1, 102, 5, 1), credentialRow(1, 101, 5, 1), credentialRow(1, 103, 9, 1),
    credentialRow(2, 201, 100, 0), credentialRow(1, '', '', 5), credentialRow(2, '', '', 2),
  ];
  source.forEach(Object.freeze);
  Object.freeze(source);
  const result = adjustReportCredentials(source);
  expect(result.rows.map(r => [r[1], r[7]])).toEqual([[102, 2], [101, 2], [103, 4], [201, 2]]);
  expect(result.summary).toEqual({ distributed: 7, deliveredIncrease: 0, pending: 0 });
  expect(source[0][7]).toBe(1);
  expect(source[4][7]).toBe(5);
  const tie = adjustReportCredentials([credentialRow(1, 102, 4, 0), credentialRow(1, 101, 4, 0), credentialRow(1, '', '', 1)]);
  expect(tie.rows.map(r => [r[1], r[7]])).toEqual([[102, 0], [101, 1]]);
});

test('iguala entregadas al total comprobado y conserva visibles los sobrantes cuando no hay cupo', () => {
  const result = adjustReportCredentials([
    credentialRow(1, 101, 31, 33), credentialRow(1, 102, 4, 2), credentialRow(1, '', '', 5),
    credentialRow(2, 201, 100, 0),
  ]);
  expect(result.rows.find(r => r[1] === 101).slice(6, 9)).toEqual([33, 33, 1]);
  expect(result.rows.find(r => r[1] === 102).slice(6, 9)).toEqual([4, 4, 1]);
  expect(result.rows.find(r => r[1] === '')[7]).toBe(3);
  expect(result.rows.find(r => r[1] === 201)[7]).toBe(0);
  expect(result.summary).toEqual({ distributed: 2, deliveredIncrease: 2, pending: 3 });
  expect(result.adjustments.reduce((sum, r) => sum + Number(r[6]), 0)).toBe(2);
  expect(result.rows.reduce((sum, r) => sum + Number(r[7]), 0)).toBe(40);
});

test('no inventa conteos ausentes ni asigna a otro sector si no hay candidatos', () => {
  const data = { sections: [], fractions: {}, sms: [], affiliation: {}, mobilizers: {}, unsectionedCredentials: { 1: 3 } };
  expect(adjustReportCredentials(buildTerritorialReport(data)).summary).toEqual({ distributed: 0, deliveredIncrease: 0, pending: 3 });
  const result = adjustReportCredentials([
    credentialRow(1, 101, '', 5), credentialRow(1, 102, 9, ''), credentialRow(1, '', '', 3),
    credentialRow(2, 201, 20, 0), credentialRow('', 301, 20, 0), credentialRow('', '', '', 2),
  ]);
  expect(result.rows[0].slice(6, 9)).toEqual(['', 5, '']);
  expect(result.rows[1].slice(6, 9)).toEqual([9, '', '']);
  expect(result.summary).toEqual({ distributed: 0, deliveredIncrease: 0, pending: 5 });
});

test('al consumir un saldo mantiene las SM sin sección y los demás datos intactos', () => {
  const data = fixture();
  data.unsectionedCredentials[2] = 2;
  const original = buildTerritorialReport(data);
  const result = adjustReportCredentials(original);
  expect(result.rows.find(r => r[1] === '')).toEqual([2, '', 0, 1, 0, 1, '', '', '', 0, 0, '']);
  result.rows.forEach((row, i) => {
    expect(row.slice(0, 6)).toEqual(original[i].slice(0, 6));
    expect(row.slice(9)).toEqual(original[i].slice(9));
  });
});

test('conserva totales por sector y respeta límites para distintos tamaños de reparto', () => {
  for (let pool = 0; pool <= 50; pool++) {
    const original = [credentialRow(1, 101, 10, 3), credentialRow(1, 102, 5, 9), credentialRow(1, 103, 20, 0),
      credentialRow(2, 201, 5, 0), credentialRow(1, '', '', pool)];
    const result = adjustReportCredentials(original);
    for (const sector of [1, 2]) {
      const total = rows => rows.filter(r => r[0] === sector).reduce((sum, r) => sum + Number(r[7]), 0);
      expect(total(result.rows)).toBe(total(original));
    }
    result.rows.filter(r => r[1] !== '').forEach(row => {
      expect(Number.isInteger(row[7])).toBe(true);
      expect(row[7]).toBeLessThanOrEqual(row[6]);
      expect(row[8]).toBeLessThanOrEqual(1);
    });
    expect(result.summary.distributed + result.summary.pending).toBe(pool);
    expect(result.summary.deliveredIncrease).toBe(4);
  }
});

test('rechaza comprobadas fraccionarias y no crea un anexo cuando no hay ajustes', () => {
  expect(() => adjustReportCredentials([credentialRow(1, '', '', 1.5)])).toThrow(/enteros no negativos/);
  expect(() => adjustReportCredentials([credentialRow(1, 101, -1, 0)])).toThrow(/enteros no negativos/);
  const data = { sections: [], fractions: {}, sms: [], affiliation: {}, mobilizers: {} };
  expect(createTerritorialReportWorkbook(data).SheetNames).toEqual(['Reporte general']);
});

test('no convierte datos ausentes en comprobadas cero ni inventa un porcentaje sin meta', () => {
  const data = fixture();
  data.affiliation[7002] = { sp: 1, entregadas_sp: 4 };
  const row = buildTerritorialReport(data).find(r => r[1] === 7002);
  expect(row.slice(6, 9)).toEqual([4, '', '']);
});

test('detecta asignaciones contradictorias y números inválidos sin emitir un archivo engañoso', () => {
  const data = fixture();
  data.sms[0].poligono = 8;
  expect(() => buildTerritorialReport(data)).toThrow(/sección 7001 tiene sectores distintos/);
  data.sms[0].poligono = 2;
  data.mobilizers[7001] = NaN;
  expect(() => buildTerritorialReport(data)).toThrow(/conteo territorial inválido/);
});

test('paginación completa incluso si el servidor devuelve menos del tamaño solicitado', async () => {
  const data = Array.from({ length: 7 }, (_, id) => ({ id }));
  const range = jest.fn(async start => ({ data: data.slice(start, start + 2), count: 7 }));
  expect(await readTerritorialRows(() => ({ range }), 5)).toEqual(data);
  expect(range.mock.calls.map(([start]) => start)).toEqual([0, 2, 4, 6]);
});

test('propaga un fallo en una página posterior y rechaza una carga truncada', async () => {
  const range = jest.fn().mockResolvedValueOnce({ data: [{ id: 1 }], count: 3 }).mockResolvedValue({ error: new Error('falló la página') });
  await expect(readTerritorialRows(() => ({ range }))).rejects.toThrow('falló la página');
  await expect(readTerritorialRows(() => ({ range: async () => ({ data: [], count: 3 }) }))).rejects.toThrow(/incompleto/);
});

test('fecha de archivo corresponde a Ciudad de México', () => {
  expect(territorialReportFilename(new Date('2026-10-10T02:00:00Z'))).toBe('reporte_general_2026-10-09.xlsx');
});
