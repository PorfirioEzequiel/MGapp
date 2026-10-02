let loadMapJson;
beforeEach(() => {
  jest.resetModules();
  loadMapJson = require('./loadMapJson').loadMapJson;
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

test('dashboard y mapa comparten una única petición y el mismo JSON', async () => {
  const rows = [{ seccion: 4251, total: 100 }];
  fetch.mockResolvedValue({ ok: true, json: async () => rows });
  const dashboard = loadMapJson('/eleccion.json');
  const map = loadMapJson('/eleccion.json');
  expect(dashboard).toBe(map);
  expect(await dashboard).toEqual(rows);
  expect(await loadMapJson('/eleccion.json')).toEqual(rows);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('un error HTTP no se guarda y permite un nuevo intento', async () => {
  fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, json: async () => [] });
  await expect(loadMapJson('/eleccion.json')).rejects.toThrow('HTTP 503');
  await expect(loadMapJson('/eleccion.json')).resolves.toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('un JSON inválido permite volver a cargar el archivo', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('JSON inválido'); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ municipio: 1 }) });
  await expect(loadMapJson('/limites.json')).rejects.toThrow('JSON inválido');
  await expect(loadMapJson('/limites.json')).resolves.toEqual({ municipio: 1 });
});
