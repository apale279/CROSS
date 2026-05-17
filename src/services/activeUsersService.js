import { auth } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';

function apiUnavailableHint(status) {
  if (import.meta.env.DEV && (status === 404 || status === 0)) {
    return ' In locale imposta VITE_API_BASE_URL nel file .env.local (vedi .env.example).';
  }
  return '';
}

export async function fetchActiveWebUsers(manifestationId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato');
  const idToken = await user.getIdToken();
  const id = (manifestationId ?? '').trim();
  const q = id ? `?manifestationId=${encodeURIComponent(id)}&tenantId=${encodeURIComponent(id)}` : '';

  const res = await fetch(apiUrl(`/api/active-users${q}`), {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.error ?? `Caricamento utenti fallito (${res.status})`) + apiUnavailableHint(res.status),
    );
  }
  return data;
}
