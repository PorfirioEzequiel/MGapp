import * as XLSX from 'xlsx';

// A fresh query per page preserves the caller's filters and stable ordering.
export async function readTerritorialRows(queryFactory, pageSize = 500) {
  const rows = [];
  let total = null;
  while (true) {
    const { data, error, count } = await queryFactory().range(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('No se recibió el listado territorial.');
    if (count != null) total = count;
    rows.push(...data);
    if (total != null && rows.length >= total) return rows;
    if (!data.length) {
      if (total != null && rows.length < total) throw new Error('El listado territorial llegó incompleto. Recarga el mapa.');
      return rows;
    }
    if (total == null && data.length < pageSize) return rows;
  }
}

const key = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};
const amount = value => {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Hay un conteo territorial inválido. Revisa los datos antes de exportar.');
  return n;
};
// Same coordinate rule used for the territorial map's markers; the pin never
// determines the section where the person works.
const located = sm => Boolean(sm.latitud && sm.longitud
  && !isNaN(Number(sm.latitud)) && !isNaN(Number(sm.longitud))
  && Number(sm.latitud) !== 0 && Number(sm.longitud) !== 0);

export const GENERAL_REPORT_COLUMNS = [
  'Sector', 'Sección', 'Fracciones', 'SMs', 'SMs con ubicación', 'SMs sin ubicación',
  'Credenciales: entregadas SP (ajustadas)', 'Credenciales: comprobadas (con reparto estimado)', 'Credenciales: % de avance ajustado',
  'Movilizadores: meta', 'Número de movilizadores', 'Movilizadores: % de avance',
];

export function buildTerritorialReport({ sections, fractions, sms, affiliation, mobilizers, unsectionedCredentials = {} }) {
  const groups = new Map();
  const getGroup = (section, sector) => {
    const sec = key(section);
    const sp = key(sector);
    const id = sec || `sin-seccion:${sp}`;
    if (!groups.has(id)) groups.set(id, { section: sec, sectors: new Set(), sms: 0, located: 0, extraCredentials: 0 });
    const group = groups.get(id);
    if (sp) group.sectors.add(sp);
    return group;
  };
  sections.forEach(s => getGroup(s.seccion, s.pologono));
  Object.keys(fractions).forEach(sec => getGroup(sec));
  Object.keys(mobilizers).forEach(sec => getGroup(sec));
  Object.entries(affiliation).forEach(([sec, af]) => getGroup(sec, af.sp));
  sms.forEach(sm => {
    const group = getGroup(sm.seccion, sm.poligono);
    group.sms++;
    if (located(sm)) group.located++;
  });
  // The map includes these in sector totals, but they cannot be assigned to an
  // invented section. Keep the section cell empty, as with unassigned SMs.
  Object.entries(unsectionedCredentials).forEach(([sector, count]) => {
    const checked = amount(count);
    if (checked > 0) getGroup(null, sector).extraCredentials += checked;
  });

  return [...groups.values()].map(group => {
    if (group.sectors.size > 1) throw new Error(`La sección ${group.section} tiene sectores distintos en las fuentes (${[...group.sectors].join(', ')}). Revisa su asignación antes de exportar.`);
    const sec = group.section;
    const af = affiliation[sec];
    const delivered = amount(af?.entregadas_sp);
    const checked = af ? amount(af.comprobadas) : (group.extraCredentials || '');
    const fractionCount = amount(fractions[sec] ?? 0);
    const target = fractionCount * 10;
    // Use the raw section count, including sections with no fraction catalog.
    const count = amount(mobilizers[sec] ?? 0);
    return [
      Number([...group.sectors][0]) || '', Number(sec) || '', fractionCount,
      group.sms, group.located, group.sms - group.located || '',
      delivered, checked, delivered > 0 && checked !== '' ? checked / delivered : '',
      target, count, target > 0 ? Math.min(count / target, 1) : '',
    ];
  }).sort((a, b) => (a[0] || Infinity) - (b[0] || Infinity) || (a[1] || Infinity) - (b[1] || Infinity));
}

export const CREDENTIAL_ADJUSTMENT_COLUMNS = [
  'Sector', 'Sección', 'Entregadas SP originales', 'Aumento de entregadas SP',
  'Entregadas SP ajustadas', 'Comprobadas originales', 'Asignación estimada',
  'Comprobadas en reporte', 'Pendientes sin sección', 'Aclaración',
];

// Presentation-only adjustment: source objects, map counts and database records
// remain independent. Every changed value is traceable in the exported annex.
export function adjustReportCredentials(sourceRows) {
  const rows = sourceRows.map(row => [...row]);
  const changes = new Map();
  const count = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Los conteos de credenciales deben ser enteros no negativos.');
    return value;
  };
  const changeFor = index => {
    if (!changes.has(index)) {
      const original = sourceRows[index];
      changes.set(index, { sector: original[0], section: original[1], delivered: original[6], checked: original[7], increase: 0, allocation: 0 });
    }
    return changes.get(index);
  };

  rows.forEach((row, index) => {
    if (row[6] !== '') count(row[6]);
    if (row[7] !== '') count(row[7]);
    if (row[1] !== '' && row[6] !== '' && row[7] !== '' && row[7] > row[6]) {
      changeFor(index).increase = row[7] - row[6];
      row[6] = row[7];
    }
  });

  const pending = [];
  rows.forEach((pool, poolIndex) => {
    if (pool[1] !== '' || !(pool[7] > 0)) return;
    const eligible = rows.map((row, index) => ({ row, index, capacity: row[6] - row[7] }))
      .filter(({ row, capacity }) => pool[0] !== '' && row[0] === pool[0] && row[1] !== ''
        && row[6] !== '' && row[7] !== '' && capacity > 0);
    const totalCapacity = eligible.reduce((sum, item) => sum + item.capacity, 0);
    const toDistribute = Math.min(pool[7], totalCapacity);
    if (toDistribute > 0) {
      // Largest remainder allocation: proportional to remaining capacity,
      // whole credentials only; section number breaks ties deterministically.
      const shares = eligible.map(item => {
        const numerator = toDistribute * item.capacity;
        return { ...item, allocation: Math.floor(numerator / totalCapacity), remainder: numerator % totalCapacity };
      }).sort((a, b) => b.remainder - a.remainder || Number(a.row[1]) - Number(b.row[1]));
      const remainder = toDistribute - shares.reduce((sum, item) => sum + item.allocation, 0);
      shares.forEach((item, i) => {
        const assigned = item.allocation + (i < remainder ? 1 : 0);
        if (!assigned) return;
        changeFor(item.index).allocation += assigned;
        item.row[7] += assigned;
      });
      pool[7] -= toDistribute;
    }
    if (pool[7] > 0) pending.push([pool[0], 'Sin sección', '', '', '', sourceRows[poolIndex][7], '',
      pool[7], pool[7], 'Cupo insuficiente en su sector. Este saldo conserva su condición de sin sección.']);
    else pool[7] = '';
  });

  rows.forEach(row => { row[8] = row[6] > 0 && row[7] !== '' ? row[7] / row[6] : ''; });
  const adjustments = [...changes.entries()].map(([index, change]) => [
    change.sector, change.section, change.delivered, change.increase, rows[index][6], change.checked,
    change.allocation, rows[index][7], '',
    change.increase ? 'Ajuste del reporte: entregadas igualadas a comprobadas registradas.'
      : 'Reparto estimado de comprobadas sin sección, proporcional al cupo del mismo sector.',
  ]).sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]));
  adjustments.push(...pending);
  return {
    rows: rows.filter(row => row[1] !== '' || row[2] || row[3] || row[7] !== '' || row[10]),
    adjustments,
    summary: {
      deliveredIncrease: [...changes.values()].reduce((sum, change) => sum + change.increase, 0),
      distributed: [...changes.values()].reduce((sum, change) => sum + change.allocation, 0),
      pending: pending.reduce((sum, row) => sum + row[8], 0),
    },
  };
}

export function createTerritorialReportWorkbook(data) {
  const { rows, adjustments } = adjustReportCredentials(buildTerritorialReport(data));
  const sheet = XLSX.utils.aoa_to_sheet([GENERAL_REPORT_COLUMNS, ...rows]);
  sheet['!cols'] = [10, 12, 12, 10, 22, 22, 43, 52, 38, 24, 28, 30].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  rows.forEach((row, r) => row.forEach((value, c) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: r + 1, c })];
    if (cell?.t === 'n') cell.z = c === 8 || c === 11 ? '0.0%' : (c < 2 ? '0' : '#,##0');
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Reporte general');
  if (adjustments.length) {
    const annex = XLSX.utils.aoa_to_sheet([CREDENTIAL_ADJUSTMENT_COLUMNS, ...adjustments]);
    annex['!cols'] = [10, 16, 28, 30, 28, 27, 24, 28, 26, 90].map(wch => ({ wch }));
    annex['!autofilter'] = { ref: annex['!ref'] };
    adjustments.forEach((row, r) => row.forEach((value, c) => {
      const cell = annex[XLSX.utils.encode_cell({ r: r + 1, c })];
      if (cell?.t === 'n') cell.z = c < 2 ? '0' : '#,##0';
    }));
    XLSX.utils.book_append_sheet(book, annex, 'Ajustes credenciales');
  }
  return book;
}

export function territorialReportFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(p => p.type === type).value;
  return `reporte_general_${part('year')}-${part('month')}-${part('day')}.xlsx`;
}
