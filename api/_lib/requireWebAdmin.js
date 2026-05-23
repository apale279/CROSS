import { getAdminDb } from './firebaseAdmin.js';

/**
 * Solo operatori centrale (o superadmin env) possono gestire account.
 */
export async function requireWebAdmin(decodedToken, tenantId) {
  if (process.env.CROSS_SUPERADMIN_EMAIL) {
    const allowed = process.env.CROSS_SUPERADMIN_EMAIL.split(',').map((s) => s.trim().toLowerCase());
    if (allowed.includes(String(decodedToken.email ?? '').toLowerCase())) {
      return;
    }
  }

  const snap = await getAdminDb()
    .doc(`manifestazioni/${tenantId}/userProfiles/${decodedToken.uid}`)
    .get();

  const data = snap.data() ?? {};
  const tipo = String(data.accessType ?? '').trim().toUpperCase();
  if (tipo === 'CENTRALE' || (!tipo && !data.pmaScopeId)) {
    return;
  }

  const err = new Error('Permesso negato: solo la centrale può gestire gli utenti.');
  err.status = 403;
  throw err;
}
