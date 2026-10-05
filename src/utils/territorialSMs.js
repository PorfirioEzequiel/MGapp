const territorialKey = value => {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : null;
};

const newBucket = () => ({ total: 0, withoutGeometry: 0 });
const increment = (bucket, hasGeometry) => {
  bucket.total += 1;
  if (!hasGeometry) bucket.withoutGeometry += 1;
};

// Count each SM once using its own territorial assignment. Historical sections
// retain their number; electoral aliases are intentionally not involved here.
export function summarizeTerritorialSMs(rows, sections) {
  const sectionIndex = new Map();
  const sectorDistricts = new Map();
  sections.forEach(section => {
    const sec = territorialKey(section.seccion);
    const sector = territorialKey(section.pologono);
    const district = territorialKey(section.distrito_federal);
    if (sec) sectionIndex.set(sec, section);
    if (sector && district) {
      if (!sectorDistricts.has(sector)) sectorDistricts.set(sector, new Set());
      sectorDistricts.get(sector).add(district);
    }
  });
  const result = {
    municipality: newBucket(), bySection: {}, bySector: {}, byDistrict: {},
    historicalSections: {}, withoutSection: 0, withoutSector: 0, withoutDistrict: 0,
  };
  rows.forEach(row => {
    const sec = territorialKey(row.seccion);
    const geometry = sectionIndex.get(sec);
    const sector = territorialKey(row.poligono) || territorialKey(geometry?.pologono);
    const districts = sectorDistricts.get(sector);
    const district = territorialKey(geometry?.distrito_federal)
      || (districts?.size === 1 ? [...districts][0] : null);
    const hasGeometry = Boolean(geometry);
    increment(result.municipality, hasGeometry);
    for (const [buckets, key] of [[result.bySection, sec], [result.bySector, sector], [result.byDistrict, district]]) {
      if (!key) continue;
      if (!buckets[key]) buckets[key] = newBucket();
      increment(buckets[key], hasGeometry);
    }
    if (!sec) result.withoutSection += 1;
    if (!sector) result.withoutSector += 1;
    if (!district) result.withoutDistrict += 1;
    if (sec && !hasGeometry) {
      const key = `${sec}:${sector || ''}`;
      if (!result.historicalSections[key]) {
        result.historicalSections[key] = { section: Number(sec), sector: sector ? Number(sector) : null, district: district ? Number(district) : null, ...newBucket() };
      }
      increment(result.historicalSections[key], false);
    }
  });
  return result;
}

export function selectTerritorialSMScope(summary, { section, sector, district } = {}) {
  if (section != null) return summary.bySection[territorialKey(section)] || newBucket();
  if (sector != null) return summary.bySector[territorialKey(sector)] || newBucket();
  if (district != null) return summary.byDistrict[territorialKey(district)] || newBucket();
  return summary.municipality;
}

// Preserve the existing active assignment when several records share a fraction.
// Every matching SM is still shown in the list and counted in the totals.
export function findSMForFraction(rows, fraction) {
  const matches = rows.filter(row => String(row.ubt) === String(fraction));
  return matches.find(row => row.status === 'ACTIVO') || matches[0] || null;
}
