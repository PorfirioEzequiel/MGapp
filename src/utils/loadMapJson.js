// Static map datasets are shared by the dashboard and the map renderer.
// Reuse successful loads for this page session; failures remain retryable.
const requests = new Map();

export function loadMapJson(path) {
  if (requests.has(path)) return requests.get(path);
  const request = fetch(path)
    .then(response => {
      if (!response.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${response.status})`);
      return response.json();
    })
    .catch(error => {
      requests.delete(path);
      throw error;
    });
  requests.set(path, request);
  return request;
}
