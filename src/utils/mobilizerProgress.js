import { readTerritorialRows } from './territorialReport';

// Keep the SP report aligned with TableroBoard: own section first, then
// the assigned active SM's section; ten mobilizers per catalog fraction.
export function buildSectorMobilizerProgress({ sections, fractions, sms, mobilizers, assignedMobilizers = [], smUsers = [] }) {
  const bySection = {};
  sections.forEach(section => {
    bySection[Number(section.seccion)] = { count: 0, meta: 0, pct: 0 };
  });
  fractions.forEach(fraction => {
    const entry = bySection[Number(fraction.seccion)];
    if (entry) entry.meta += 10;
  });
  const smSection = new Map();
  sms.forEach(sm => {
    if (sm.usuario) smSection.set(sm.usuario, sm.seccion);
  });
  const sectorSMs = new Set(smUsers);
  let outsideMapCount = 0;
  mobilizers.forEach(mobilizer => {
    const section = mobilizer.seccion ?? smSection.get(mobilizer.movilizador);
    const entry = bySection[Number(section)];
    if (entry) entry.count += 1;
    else if (sectorSMs.has(mobilizer.movilizador)) outsideMapCount += 1;
  });
  const total = { count: 0, meta: 0, pct: null };
  Object.values(bySection).forEach(entry => {
    entry.pct = entry.meta > 0 ? Math.min(entry.count / entry.meta * 100, 100) : 0;
    total.count += entry.count;
    total.meta += entry.meta;
  });
  if (total.meta > 0) total.pct = Math.min(total.count / total.meta * 100, 100);
  const bySM = {};
  assignedMobilizers.forEach(row => {
    if (!sectorSMs.has(row.movilizador)) return;
    if (!bySM[row.movilizador]) bySM[row.movilizador] = [];
    bySM[row.movilizador].push({ id: row.id, name: [row.nombre, row.a_paterno, row.a_materno].filter(Boolean).join(' ').trim() || 'Sin nombre' });
  });
  Object.values(bySM).forEach(rows => rows.sort((a, b) => a.name.localeCompare(b.name, 'es')));
  return { bySection, total, bySM, outsideMapCount };
}

export async function loadSectorMobilizerProgress(client, sections, signal, smUsers = []) {
  const sectionNumbers = [...new Set(sections.map(section => Number(section.seccion)))];
  const [fractions, sms, mobilizers, assignedMobilizers] = await Promise.all([
    readTerritorialRows(() => client.from('ubt_catalogo')
      .select('seccion', { count: 'exact' }).in('seccion', sectionNumbers)
      .order('seccion').order('fraccion').abortSignal(signal)),
    readTerritorialRows(() => client.from('ciudadania')
      .select('seccion, usuario', { count: 'exact' }).eq('puesto', 'SM').eq('status', 'ACTIVO')
      .order('id').abortSignal(signal)),
    readTerritorialRows(() => client.from('ciudadania')
      .select('seccion, movilizador', { count: 'exact' }).eq('puesto', 'MOVILIZADOR').eq('status', 'ACTIVO')
      .order('id').abortSignal(signal)),
    smUsers.length ? readTerritorialRows(() => client.from('ciudadania')
      .select('id, nombre, a_paterno, a_materno, movilizador', { count: 'exact' })
      .eq('puesto', 'MOVILIZADOR').eq('status', 'ACTIVO').in('movilizador', smUsers)
      .order('id').abortSignal(signal)) : Promise.resolve([]),
  ]);
  return buildSectorMobilizerProgress({ sections, fractions, sms, mobilizers, assignedMobilizers, smUsers });
}

export const MOBILIZER_SCALE = [
  { label: 'Excelente', range: '≥ 90%', color: '#16A34A', min: 90 },
  { label: 'Bien', range: '75–89%', color: '#65A30D', min: 75 },
  { label: 'Regular', range: '50–74%', color: '#CA8A04', min: 50 },
  { label: 'Bajo', range: '25–49%', color: '#EA580C', min: 25 },
  { label: 'Crítico', range: '< 25%', color: '#DC2626', min: 0 },
];

export const mobilizerStatus = pct => pct == null
  ? { label: 'Sin meta', color: '#9CA3AF' }
  : MOBILIZER_SCALE.find(status => pct >= status.min);
