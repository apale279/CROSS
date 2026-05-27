import { getAdminDb } from './firebaseAdmin.js';

function isSuperadminEmail(email) {
  if (!process.env.CROSS_SUPERADMIN_EMAIL) return false;
  const allowed = process.env.CROSS_SUPERADMIN_EMAIL.split(',').map((s) => s.trim().toLowerCase());
  return allowed.includes(String(email ?? '').toLowerCase());
}

/**
 * Può modificare impostazioni e gestire account (POST/PATCH/DELETE admin-users).
 */
export async function requireImpostazioniEditor(decodedToken, tenantId) {
  if (isSuperadminEmail(decodedToken.email)) return;

  const snap = await getAdminDb()
    .doc(`manifestazioni/${tenantId}/userProfiles/${decodedToken.uid}`)
    .get();

  const data = snap.data() ?? {};
  const tipo = String(data.accessType ?? '').trim().toUpperCase();
  const isCentrale = tipo === 'CENTRALE' || (!tipo && !data.pmaScopeId);

  if (!isCentrale) {
    const err = new Error('Permesso negato: solo la centrale può modificare le impostazioni.');
    err.status = 403;
    throw err;
  }

  if (data.canEditImpostazioni === false) {
    const err = new Error(
      'Permesso negato: account centrale in sola lettura sulle impostazioni.',
    );
    err.status = 403;
    throw err;
  }
}
