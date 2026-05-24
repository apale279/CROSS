import { getAdminAuth } from './firebaseAdmin.js';

/**
 * Elimina utente Firebase Auth + eventuale duplicato stessa email.
 * @param {string} uid
 * @returns {Promise<{ email: string | null }>}
 */
export async function deleteAuthUserCompletely(uid) {
  const auth = getAdminAuth();
  let email = null;

  try {
    const record = await auth.getUser(uid);
    email = record.email ?? null;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  if (email) {
    try {
      const orphan = await auth.getUserByEmail(email);
      if (orphan.uid !== uid) {
        await auth.deleteUser(orphan.uid);
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  return { email };
}

/**
 * Crea utente Auth; se l'email esiste solo come account orfano (senza profilo tenant), lo rimuove e riprova.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.displayName]
 * @param {(uid: string) => Promise<boolean>} params.hasProfileInTenant
 */
export async function createAuthUserWithEmailReclaim({ email, password, displayName, hasProfileInTenant }) {
  const auth = getAdminAuth();

  const tryCreate = async () =>
    auth.createUser({
      email,
      password,
      displayName: displayName || undefined,
    });

  try {
    return await tryCreate();
  } catch (err) {
    if (err.code !== 'auth/email-already-exists') throw err;

    const existing = await auth.getUserByEmail(email);
    const inUse = await hasProfileInTenant(existing.uid);
    if (inUse) {
      const conflict = new Error('Questa email è già associata a un account su questa manifestazione.');
      conflict.status = 409;
      throw conflict;
    }

    await auth.deleteUser(existing.uid);
    return await tryCreate();
  }
}
