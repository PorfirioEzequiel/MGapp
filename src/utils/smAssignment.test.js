import { changedCitizenFields, hasAssignmentChanges, validateSmAssignment } from './smAssignment';

const catalog = [{ sector: 1, seccion: 7001, fraccion: 'F7001-01', dtto_fed: 5, dtto_loc: 33 }];
const assignment = { poligono: 1, seccion: 7001, ubt: 'F7001-01', dtto_fed: 5, dtto_loc: 33 };

test('la validación laboral acepta un domicilio fuera de la sección de trabajo', () => {
  expect(validateSmAssignment({ ...assignment, latitud: 0, longitud: 0 }, catalog, 1)).toBeNull();
  expect(hasAssignmentChanges(assignment, { ...assignment, latitud: 19.8, longitud: -99 })).toBe(false);
});

test.each([
  { ubt: 'F7002-01' }, { seccion: 7002 }, { poligono: 8 }, { ubt: '' }, { dtto_fed: 20 },
])('rechaza una combinación laboral inválida %j', change => {
  expect(validateSmAssignment({ ...assignment, ...change }, catalog, 1)).toEqual(expect.any(String));
});

test('normaliza tipos del catálogo sin reescribir campos intactos', () => {
  const strings = Object.fromEntries(Object.entries(assignment).map(([k, v]) => [k, String(v)]));
  expect(validateSmAssignment(strings, catalog, '1')).toBeNull();
  expect(hasAssignmentChanges(assignment, strings)).toBe(false);
  expect(changedCitizenFields(assignment, { ...strings, latitud: 19.8 })).toEqual({ latitud: 19.8 });
});
