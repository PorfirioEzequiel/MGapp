// La asignación de trabajo se valida por catálogo, nunca por las coordenadas del domicilio.
export const SM_ASSIGNMENT_FIELDS = ['dtto_fed', 'dtto_loc', 'poligono', 'seccion', 'ubt'];

export const assignmentValue = value => String(value ?? '').trim();

export const hasAssignmentChanges = (original, draft) =>
  SM_ASSIGNMENT_FIELDS.some(field => assignmentValue(original?.[field]) !== assignmentValue(draft?.[field]));

export function validateSmAssignment(draft, catalog, sectorScope) {
  const sector = assignmentValue(draft.poligono);
  const section = assignmentValue(draft.seccion);
  const fraction = assignmentValue(draft.ubt);
  if (!sector || !section || !fraction) {
    return 'Selecciona el sector, la sección y la Fracción (UBT) donde trabajará la SM.';
  }
  if (sectorScope != null && sector !== assignmentValue(sectorScope)) {
    return 'La asignación debe pertenecer al sector del SP.';
  }
  const row = catalog.find(item =>
    assignmentValue(item.sector) === sector &&
    assignmentValue(item.seccion) === section &&
    assignmentValue(item.fraccion) === fraction
  );
  if (!row) return 'La Fracción (UBT) no corresponde a la sección y sector seleccionados. Selecciónala nuevamente.';
  if (['dtto_fed', 'dtto_loc'].some(field => assignmentValue(row[field]) !== assignmentValue(draft[field]))) {
    return 'Los distritos no corresponden a la asignación seleccionada. Selecciona nuevamente la sección.';
  }
  return null;
}

// No volver a enviar campos intactos: conserva datos históricos y cambios ajenos al formulario.
export const changedCitizenFields = (original, payload) => Object.fromEntries(
  Object.entries(payload).filter(([field, value]) => assignmentValue(value) !== assignmentValue(original?.[field]))
);
