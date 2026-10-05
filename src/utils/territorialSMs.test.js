import { summarizeTerritorialSMs, selectTerritorialSMScope, findSMForFraction } from './territorialSMs';

const sections = [
  { seccion: 7011, pologono: 2, distrito_federal: 5 },
  { seccion: 7046, pologono: 1, distrito_federal: 5 },
  { seccion: 6264, pologono: 6, distrito_federal: 20 },
];

test('incluye todos los registros sin filtrar estatus ni perder las secciones históricas', () => {
  const rows = [
    { seccion: '4191', poligono: 2, status: 'ACTIVO' },
    { seccion: '4208', poligono: 1, status: 'ACTIVO' },
    { seccion: '7011', poligono: 2, status: 'ELIMINADO' },
    { seccion: '7046', poligono: 1, status: 'SOLICITUD DE ALTA' },
    { seccion: '6264', poligono: 6, status: 'RECHAZADA' },
    { seccion: '6264', poligono: 6, status: 'ACTIVO' },
  ];
  const result = summarizeTerritorialSMs(rows, sections);
  expect(result.municipality).toMatchObject({ total: 6, withoutGeometry: 2 });
  expect(result.bySector[1].total).toBe(2);
  expect(result.bySector[2].total).toBe(2);
  expect(result.byDistrict[5].total).toBe(4);
  expect(result.bySection[4191].total).toBe(1);
  expect(result.bySection[7011].total).toBe(1);
  expect(Object.values(result.bySector).reduce((sum, bucket) => sum + bucket.total, 0)).toBe(6);
  expect(Object.values(result.byDistrict).reduce((sum, bucket) => sum + bucket.total, 0)).toBe(6);
  expect(rows[0].seccion).toBe('4191');
});

test('conserva la SM activa de la fracción como referencia sin descartar los otros registros', () => {
  const rows = [
    { id: 1, ubt: 'F7011-01', status: 'ELIMINADO' },
    { id: 2, ubt: 'F7011-01', status: 'ACTIVO' },
    { id: 3, ubt: 'F7011-02', status: 'SOLICITUD DE ALTA' },
  ];
  expect(findSMForFraction(rows, 'F7011-01')).toBe(rows[1]);
  expect(findSMForFraction(rows, 'F7011-02')).toBe(rows[2]);
  expect(findSMForFraction(rows, 'F7011-03')).toBeNull();
  expect(rows).toHaveLength(3);
});

test('los datos incompletos permanecen en el total sin inventar asignaciones', () => {
  const result = summarizeTerritorialSMs([
    { seccion: null, poligono: 2, status: 'ACTIVO' },
    { seccion: 9999, poligono: null, status: null },
    { seccion: 7046, poligono: null, status: 'ACTIVO' },
  ], sections);
  expect(result.municipality.total).toBe(3);
  expect(result.bySector[2].total).toBe(1);
  expect(result.bySector[1].total).toBe(1);
  expect(result).toMatchObject({ withoutSection: 1, withoutSector: 1, withoutDistrict: 1 });
});

test('un sector con más de un distrito no permite adivinar el distrito histórico', () => {
  const result = summarizeTerritorialSMs([{ seccion: 4191, poligono: 2, status: 'ACTIVO' }], [
    ...sections, { seccion: 8000, pologono: 2, distrito_federal: 20 },
  ]);
  expect(result.bySector[2].total).toBe(1);
  expect(result.withoutDistrict).toBe(1);
  expect(result.byDistrict).toEqual({});
});

test('el alcance seleccionado usa sección, sector, distrito o municipio sin duplicar registros', () => {
  const result = summarizeTerritorialSMs([{ seccion: 4191, poligono: 2, status: 'ACTIVO' }], sections);
  expect(selectTerritorialSMScope(result, { section: 4191, sector: 2, district: 5 }).total).toBe(1);
  expect(selectTerritorialSMScope(result, { sector: 2 }).total).toBe(1);
  expect(selectTerritorialSMScope(result, { district: 5 }).total).toBe(1);
  expect(selectTerritorialSMScope(result).total).toBe(1);
  expect(selectTerritorialSMScope(result, { section: 7011 }).total).toBe(0);
});
