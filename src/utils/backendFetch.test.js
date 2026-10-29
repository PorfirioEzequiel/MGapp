let backendFetch;
let previousUrl;
let previousMode;
beforeEach(() => {
  previousMode = process.env.NODE_ENV;
  previousUrl = process.env.REACT_APP_BACKEND_URL;
  process.env.REACT_APP_BACKEND_URL = 'https://backend.test/';
  jest.resetModules();
  backendFetch = require('./backendFetch').backendFetch;
  global.fetch = jest.fn();
});
afterEach(() => {
  process.env.NODE_ENV = previousMode;
  if (previousUrl === undefined) delete process.env.REACT_APP_BACKEND_URL;
  else process.env.REACT_APP_BACKEND_URL = previousUrl;
  jest.useRealTimers();
});

test('usa localhost cuando el servidor principal devuelve JSON inválido', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('HTML'); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ bySec: [] }) });
  await expect(backendFetch('/api/comprobadas')).resolves.toEqual({ bySec: [] });
  expect(fetch.mock.calls.map(call => call[0])).toEqual(['https://backend.test/api/comprobadas', 'http://localhost:3003/api/comprobadas']);
});
test('una conexión bloqueada expira y pasa al siguiente servidor', async () => {
  jest.useFakeTimers();
  fetch.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Abortado')));
  })).mockResolvedValueOnce({ ok: true, json: async () => [] });
  const request = backendFetch('/api/afiliacion', { timeoutMs: 100 });
  jest.advanceTimersByTime(100);
  await expect(request).resolves.toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});
test('devuelve null cuando ninguna conexión responde correctamente', async () => {
  fetch.mockResolvedValue({ ok: false });
  await expect(backendFetch('/api/afiliacion')).resolves.toBeNull();
});

test('en producción consulta primero la API del sitio sin caché ni conexiones al localhost del visitante', async () => {
  process.env.NODE_ENV = 'production';
  jest.resetModules();
  backendFetch = require('./backendFetch').backendFetch;
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ bySec: [{ seccion: 4251, comprobadas: 42 }], bySp0: {} }) });
  await expect(backendFetch('/api/comprobadas')).resolves.toMatchObject({ bySec: [{ comprobadas: 42, seccion: 4251 }] });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`${window.location.origin}/api/comprobadas`, expect.objectContaining({ cache: 'no-store' }));
  fetch.mockClear().mockResolvedValue({ ok: false });
  await expect(backendFetch('/api/comprobadas')).resolves.toBeNull();
  expect(fetch.mock.calls.map(call => call[0])).toEqual([`${window.location.origin}/api/comprobadas`, 'https://backend.test/api/comprobadas']);
});

test('si la API del sitio devuelve HTML, producción prueba el backend configurado', async () => {
  process.env.NODE_ENV = 'production';
  jest.resetModules();
  backendFetch = require('./backendFetch').backendFetch;
  fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('HTML'); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ bySec: [], bySp0: {} }) });
  await expect(backendFetch('/api/comprobadas')).resolves.toEqual({ bySec: [], bySp0: {} });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('las rutas API publicadas se resuelven antes de la regla de la aplicación React', () => {
  const fs = require('fs');
  const path = require('path');
  const rules = fs.readFileSync(path.join(__dirname, '../../public/_redirects'), 'utf8').trim().split(/\r?\n/).map(line => line.split(/\s+/));
  const resolve = url => rules.find(([from]) => from === url || from === '/*')?.[1];
  expect(resolve('/api/comprobadas')).toBe('/.netlify/functions/comprobadas');
  expect(resolve('/api/afiliacion')).toBe('/.netlify/functions/afiliacion');
  expect(resolve('/coordinador/sp-demo')).toBe('/index.html');
});
