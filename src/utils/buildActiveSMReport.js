export const ACTIVE_SM_REPORT_COLUMNS = ['Sector', 'Sección', 'Fracción', 'SM activas', 'Observación'];

const territorialId = value => {
  if (value == null || String(value).trim() === '') return '';
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Hay un sector o sección inválido. Revisa la asignación antes de exportar.');
  return n;
};
const fractionId = value => String(value ?? '').trim().toUpperCase();
const compareIds = (a, b) => (a === '' ? Infinity : a) - (b === '' ? Infinity : b) || 0;

// Work assignments come from poligono/seccion/ubt; domicile coordinates do not
// participate. Unmatched assignments remain separate instead of being inferred.
export function buildActiveSMReport({ fractions, sms }) {
  const groups = new Map();
  const groupFor = (sector, section, fraction) => {
    const key = JSON.stringify([sector, section, fraction]);
    if (!groups.has(key)) groups.set(key, { sector, section, fraction, count: 0, inCatalog: false });
    return groups.get(key);
  };

  fractions.forEach(row => {
    const fraction = fractionId(row.fraccion);
    if (!fraction) throw new Error('Hay una fracción vacía en el catálogo. Revisa los datos antes de exportar.');
    groupFor(territorialId(row.sector), territorialId(row.seccion), fraction).inCatalog = true;
  });

  const seen = new Set();
  sms.filter(sm => sm.puesto === 'SM' && sm.status === 'ACTIVO').forEach(sm => {
    if (sm.id != null) {
      const id = String(sm.id);
      if (seen.has(id)) throw new Error('Se recibió una SM repetida. Vuelve a descargar para actualizar el listado.');
      seen.add(id);
    }
    groupFor(territorialId(sm.poligono), territorialId(sm.seccion), fractionId(sm.ubt)).count += 1;
  });

  const sheets = new Map();
  [...groups.values()].sort((a, b) => compareIds(a.sector, b.sector)
    || compareIds(a.section, b.section)
    || (a.fraction === '' ? 1 : b.fraction === '' ? -1 : a.fraction.localeCompare(b.fraction, 'es', { numeric: true })))
    .forEach(group => {
      const name = group.sector === '' ? 'Sin sector' : `Sector ${group.sector}`;
      if (!sheets.has(name)) sheets.set(name, { name, rows: [] });
      const notes = [];
      if (group.sector === '') notes.push('Sin sector asignado');
      if (group.section === '') notes.push('Sin sección asignada');
      if (!group.fraction) notes.push('Sin fracción asignada');
      else if (!group.inCatalog) notes.push('Fracción sin coincidencia en el catálogo');
      sheets.get(name).rows.push([
        group.sector, group.section, group.fraction || 'Sin fracción asignada', group.count, notes.join('. '),
      ]);
    });
  return [...sheets.values()];
}
