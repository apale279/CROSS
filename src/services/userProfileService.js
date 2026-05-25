import { doc, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
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

export async function saveUserProfile(manifestationId, uid, { nome, nomeUtente, pmaScopeId }) {
  const payload = {
    nome: nome?.trim() ?? '',
    nomeUtente: nomeUtente?.trim() ?? '',
    aggiornatoIl: serverTimestamp(),
  };
  if (pmaScopeId !== undefined) {
    payload.pmaScopeId = String(pmaScopeId ?? '').trim();
  }
  await setDoc(userProfileDocRef(manifestationId, uid), payload, { merge: true });
}

/** Firma medico (PNG + SVG) sul profilo utente. */
export async function saveMedicoFirma(manifestationId, uid, { pngDataUrl, svgDataUrl }) {
  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      firma_medico_base64: pngDataUrl?.trim() ?? '',
      firma_medico_svg: svgDataUrl?.trim() ?? '',
      firmaUrl: deleteField(),
      aggiornatoIl: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearMedicoFirma(manifestationId, uid) {
  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      firma_medico_base64: deleteField(),
      firma_medico_svg: deleteField(),
      firmaUrl: deleteField(),
      aggiornatoIl: serverTimestamp(),
    },
    { merge: true },
  );
}
