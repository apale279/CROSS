import { addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from '../lib/firestorePaths';
import { userProfileDocRef } from './userProfileService';

/**
 * @param {string} manifestationId
 * @param {{ uid: string, nomeUtente?: string|null, nome?: string|null, type: string, detail?: string|null, path?: string|null }} payload
 */
export async function logUserActivity(manifestationId, payload) {
  const { uid, nomeUtente, nome, type, detail, path } = payload;
  if (!manifestationId || !uid || !type) return;
  const colRef = collection(
    db,
    COLLECTIONS.manifestazioni,
    manifestationId,
    'activityLog',
  );
  await addDoc(colRef, {
    userId: uid,
    nomeUtente: nomeUtente ?? null,
    nome: nome ?? null,
    type,
    detail: detail ?? null,
    path: path ?? null,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      lastSeenAt: serverTimestamp(),
      lastPath: path ?? null,
      lastActivityType: type,
    },
    { merge: true },
  );
}
