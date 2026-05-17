/** Base URL API (vuoto = stesso host, es. produzione Vercel). In locale: VITE_API_BASE_URL=https://tuo-progetto.vercel.app */
export function apiUrl(path) {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
