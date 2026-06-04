/**
 * URL API:
 * - Dev: path relativo `/api/...` → proxy Vite (vite.config) verso VITE_API_BASE_URL
 * - Produzione / sandbox: `/api` sullo stesso host del sito (Vercel Functions)
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return p;
  }
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    // Cross-origin dal browser → CORS → "Failed to fetch". Usa le API del deploy corrente.
    if (base && base !== origin) {
      console.warn(
        `[CROSS] VITE_API_BASE_URL (${base}) ≠ sito corrente (${origin}); uso ${p} sullo stesso host.`,
      );
      return p;
    }
  }
  return base ? `${base}${p}` : p;
}
