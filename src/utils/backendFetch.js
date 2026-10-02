const prodOrigin = process.env.NODE_ENV === 'production' && typeof window !== 'undefined'
  ? window.location.origin
  : null;

const BACKEND_URLS = [...new Set([
  process.env.REACT_APP_BACKEND_URL,
  prodOrigin,
  'http://localhost:3003',
].filter(Boolean))];

export async function backendFetch(path, { timeoutMs = 10000 } = {}) {
  for (const base of BACKEND_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}${path}`, { signal: controller.signal });
      if (r.ok) return await r.json();
    } catch {} finally {
      clearTimeout(timer);
    }
  }
  return null;
}
