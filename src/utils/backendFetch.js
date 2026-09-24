const prodOrigin = process.env.NODE_ENV === 'production' && typeof window !== 'undefined'
  ? window.location.origin
  : null;

const BACKEND_URLS = [...new Set([
  process.env.REACT_APP_BACKEND_URL,
  prodOrigin,
  'http://localhost:3003',
].filter(Boolean))];

export async function backendFetch(path) {
  for (const base of BACKEND_URLS) {
    try {
      const r = await fetch(`${base}${path}`);
      if (r.ok) return r.json();
    } catch {}
  }
  return null;
}
