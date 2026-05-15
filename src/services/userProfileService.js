import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from '../lib/firestorePaths';

export function userProfileDocRef(manifestationId, uid) {
  return doc(db, COLLECTIONS.manifestazioni, manifestationId, 'userProfiles', uid);
}

/** Prima registrazione (documento nuovo). */
export async function createUserProfile(manifestationId, uid, { nome, nomeUtente }) {
  await setDoc(userProfileDocRef(manifestationId, uid), {
    nome: nome?.trim() ?? '',
    nomeUtente: nomeUtente?.trim() ?? '',
    creatoIl: serverTimestamp(),
  });
}

export async function saveUserProfile(manifestationId, uid, { nome, nomeUtente }) {
  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      nome: nome?.trim() ?? '',
      nomeUtente: nomeUtente?.trim() ?? '',
      aggiornatoIl: serverTimestamp(),
    },
    { merge: true },
  );
}
