import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS, mezziPath } from '../lib/firestorePaths';
import { userProfileDocRef } from './userProfileService';
import { createSessionToken } from '../lib/deviceSession';

const BATCH_LIMIT = 450;

async function commitBatches(updates) {
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { ref, data } of updates.slice(i, i + BATCH_LIMIT)) {
      batch.set(ref, data, { merge: true });
    }
    await batch.commit();
  }
}

/** Imposta token sessione sul profilo utente (logout forzato se azzerato da remoto). */
export async function ensureUserSessionToken(manifestationId, uid) {
  const token = createSessionToken();
  const ref = userProfileDocRef(manifestationId, uid);
  await setDoc(
    ref,
    {
      active_session_token: token,
      sessionUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

/** Imposta token sessione sul documento mezzo (tablet / equipaggio). */
export async function ensureMezzoSessionToken(manifestationId, sigla) {
  const token = createSessionToken();
  const ref = doc(db, ...mezziPath(manifestationId), sigla);
  await setDoc(
    ref,
    {
      active_session_token: token,
      sessionUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

/** Logout globale: azzera sessioni su tutti i mezzi. */
export async function clearAllMezziSessionTokens(manifestationId) {
  const snap = await getDocs(collection(db, ...mezziPath(manifestationId)));
  const updates = snap.docs.map((d) => ({
    ref: d.ref,
    data: {
      active_session_token: null,
      sessionUpdatedAt: serverTimestamp(),
    },
  }));
  await commitBatches(updates);
  return snap.size;
}

/** Logout globale: azzera sessioni su tutti i profili utente. */
export async function clearAllUserSessionTokens(manifestationId) {
  const colRef = collection(
    db,
    COLLECTIONS.manifestazioni,
    manifestationId,
    'userProfiles',
  );
  const snap = await getDocs(colRef);
  const updates = snap.docs.map((d) => ({
    ref: d.ref,
    data: {
      active_session_token: null,
      sessionUpdatedAt: serverTimestamp(),
    },
  }));
  await commitBatches(updates);
  return snap.size;
}
