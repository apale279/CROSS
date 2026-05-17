/**
 * URL API:
 * - Dev: path relativo `/api/...` → proxy Vite (vite.config) verso VITE_API_BASE_URL
 * - Produzione: stesso host (`/api/...`) su Vercel
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return p;
  }
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  return base ? `${base}${p}` : p;
}
