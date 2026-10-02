let backendFetch;
let previousUrl;
beforeEach(() => {
  previousUrl = process.env.REACT_APP_BACKEND_URL;
  process.env.REACT_APP_BACKEND_URL = 'https://backend.test/';
  jest.resetModules();
  backendFetch = require('./backendFetch').backendFetch;
  global.fetch = jest.fn();
});
afterEach(() => {
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
