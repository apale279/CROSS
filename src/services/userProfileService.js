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

/** Profilo operatore kiosk iPad (creato al primo scan QR). */
export async function ensurePmaIpadKioskProfile(
  manifestationId,
  uid,
  { email, pmaId, pmaNome },
) {
  const scope = String(pmaId ?? '').trim();
  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      email: String(email ?? '').trim().toLowerCase(),
      nome: `iPad firma — ${String(pmaNome ?? scope).trim() || 'PMA'}`,
      nomeUtente: scope ? `ipad-${scope}` : 'ipad',
      accessType: 'PMA',
      pmaRank: 'Infermiere',
      pmaScopeId: scope,
      isPmaIpadKiosk: true,
      aggiornatoIl: serverTimestamp(),
      creatoIl: serverTimestamp(),
    },
    { merge: true },
  );
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

/** Note personali medico (promemoria dimissione, solo profilo utente). */
export async function saveMedicoNotePersonali(manifestationId, uid, note) {
  await setDoc(
    userProfileDocRef(manifestationId, uid),
    {
      note_personali: String(note ?? '').trim(),
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
