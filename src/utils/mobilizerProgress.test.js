import { buildSectorMobilizerProgress, loadSectorMobilizerProgress, mobilizerStatus } from './mobilizerProgress';

test('coincide con Admin: sección propia primero, fallback al SM y meta del catálogo', () => {
  const sections = [4251, 4252, 4253].map(seccion => ({ seccion }));
  const result = buildSectorMobilizerProgress({
    sections,
    fractions: [{ seccion: '4251' }, { seccion: 4251 }, { seccion: 4252 }, { seccion: 9999 }],
    sms: [{ usuario: 'sm1', seccion: 4251 }, { usuario: 'sm2', seccion: 4252 }],
    mobilizers: [
      { seccion: 4252, movilizador: 'sm1' }, // own section overrides SM
      { seccion: null, movilizador: 'sm1' },
      { seccion: 4253 }, // count even without catalog fractions
      { seccion: 9999, movilizador: 'sm1' }, // never count another sector
      { seccion: null, movilizador: 'unknown' },
    ],
  });
  expect(result.bySection).toEqual({
    4251: { count: 1, meta: 20, pct: 5 },
    4252: { count: 1, meta: 10, pct: 10 },
    4253: { count: 1, meta: 0, pct: 0 },
  });
  expect(result.total).toEqual({ count: 3, meta: 30, pct: 10 });
});

test('mantiene conteos por encima de meta, limita la barra y distingue cero de falta de meta', () => {
  const inputs = { sections: [{ seccion: 1 }], sms: [], mobilizers: Array.from({ length: 12 }, () => ({ seccion: 1 })) };
  expect(buildSectorMobilizerProgress({ ...inputs, fractions: [{ seccion: 1 }] }).total)
    .toEqual({ count: 12, meta: 10, pct: 100 });
  expect(buildSectorMobilizerProgress({ ...inputs, fractions: [] }).total)
    .toEqual({ count: 12, meta: 0, pct: null });
  expect(mobilizerStatus(0).label).toBe('Crítico');
  expect(mobilizerStatus(null).label).toBe('Sin meta');
});

test('las tarjetas cuentan todos los registros del SM y explican los que no tienen sección en el mapa', () => {
  const rows = [
    { id: 1, movilizador: 'sm1', seccion: 1, nombre: 'ZULMA', telefono_1: 'privado' },
    { id: 2, movilizador: 'sm1', seccion: 999, nombre: 'ANA', a_paterno: 'LÓPEZ', curp: 'privado' },
    { id: 3, movilizador: 'otro', seccion: 2, nombre: 'OTRO SECTOR' },
  ];
  const result = buildSectorMobilizerProgress({ sections: [{ seccion: 1 }], fractions: [{ seccion: 1 }],
    sms: [{ usuario: 'sm1', seccion: 1 }], mobilizers: rows, assignedMobilizers: rows, smUsers: ['sm1'] });
  expect(result.total.count).toBe(1);
  expect(result.outsideMapCount).toBe(1);
  expect(result.bySM).toEqual({ sm1: [{ id: 2, name: 'ANA LÓPEZ' }, { id: 1, name: 'ZULMA' }] });
});

test('carga todas las páginas de activos y limita los totales a las secciones del SP', async () => {
  const queries = [];
  const rows = Array.from({ length: 1001 }, () => ({ seccion: 1, puesto: 'MOVILIZADOR', status: 'ACTIVO' }));
  rows.push({ seccion: 1, puesto: 'MOVILIZADOR', status: 'ELIMINADO' });
  rows.push({ seccion: 2, puesto: 'MOVILIZADOR', status: 'ACTIVO' });
  const client = { from: table => {
    const query = { filters: {}, table };
    query.select = fields => { query.fields = fields; return query; };
    query.eq = (field, value) => { query.filters[field] = value; return query; };
    query.in = (field, values) => { query.inFilter = [field, values]; return query; };
    query.order = () => query;
    query.abortSignal = () => query;
    query.range = (start, end) => {
      queries.push(query);
      let data = table === 'ubt_catalogo' ? [{ seccion: 1 }] : rows;
      data = data.filter(row => Object.entries(query.filters).every(([field, value]) => row[field] === value));
      if (query.inFilter) data = data.filter(row => query.inFilter[1].includes(row[query.inFilter[0]]));
      return Promise.resolve({ data: data.slice(start, end + 1), count: data.length, error: null });
    };
    return query;
  } };
  const result = await loadSectorMobilizerProgress(client, [{ seccion: 1 }], new AbortController().signal);
  expect(result.total).toEqual({ count: 1001, meta: 10, pct: 100 });
  expect(queries.filter(q => q.filters.puesto === 'MOVILIZADOR')).toHaveLength(3);
  expect(queries.filter(q => q.table === 'ciudadania').every(q => q.filters.status === 'ACTIVO')).toBe(true);
  expect(queries.some(q => /nombre|telefono|curp|password/.test(q.fields))).toBe(false);
});
