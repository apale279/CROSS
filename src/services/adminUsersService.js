import { auth } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';

async function authFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato');
  const idToken = await user.getIdToken();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Errore (${res.status})`);
  }
  return data;
}

export function fetchAdminUsers(manifestationId) {
  const q = manifestationId
    ? `?manifestationId=${encodeURIComponent(manifestationId)}&tenantId=${encodeURIComponent(manifestationId)}`
    : '';
  return authFetch(`/api/admin-users${q}`);
}

export function createAdminUser(manifestationId, payload) {
  const q = manifestationId
    ? `?manifestationId=${encodeURIComponent(manifestationId)}&tenantId=${encodeURIComponent(manifestationId)}`
    : '';
  return authFetch(`/api/admin-users${q}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(manifestationId, payload) {
  const q = manifestationId
    ? `?manifestationId=${encodeURIComponent(manifestationId)}&tenantId=${encodeURIComponent(manifestationId)}`
    : '';
  return authFetch(`/api/admin-users${q}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUser(manifestationId, uid) {
  const base = manifestationId
    ? `?manifestationId=${encodeURIComponent(manifestationId)}&tenantId=${encodeURIComponent(manifestationId)}&uid=${encodeURIComponent(uid)}`
    : `?uid=${encodeURIComponent(uid)}`;
  return authFetch(`/api/admin-users${base}`, { method: 'DELETE' });
}
