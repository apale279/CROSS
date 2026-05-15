import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { impostazioniPath } from '../lib/firestorePaths';

export function impostazioniDocRef(manifestationId) {
  return doc(db, ...impostazioniPath(manifestationId));
}

/** Crea solo il documento vuoto (solo manifestationId), senza sovrascrivere campi esistenti. */
export async function ensureImpostazioniDocument(manifestationId) {
  const docRef = impostazioniDocRef(manifestationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { manifestationId }, { merge: true });
  }
}

/** Salva un solo campo top-level con updateDoc (o setDoc merge se il doc non esiste). */
export async function saveImpostazioniField(manifestationId, fieldKey, value) {
  if (fieldKey == null || fieldKey === '') return;
  const docRef = impostazioniDocRef(manifestationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { manifestationId, [fieldKey]: value }, { merge: true });
    return;
  }
  await updateDoc(docRef, { [fieldKey]: value });
}

/** Aggiorna solo una voce di dettagliPerTipoEvento senza riscrivere l'intero oggetto. */
export async function saveDettaglioTipoEvento(manifestationId, tipo, list) {
  if (!tipo) return;
  const docRef = impostazioniDocRef(manifestationId);
  const snap = await getDoc(docRef);
  const patch = { [`dettagliPerTipoEvento.${tipo}`]: list };
  if (!snap.exists()) {
    await setDoc(
      docRef,
      { manifestationId, dettagliPerTipoEvento: { [tipo]: list } },
      { merge: true },
    );
    return;
  }
  await updateDoc(docRef, patch);
}

/** @deprecated usa saveImpostazioniField */
export async function updateImpostazioniDocument(manifestationId, partialFields) {
  const keys = Object.keys(partialFields ?? {});
  if (keys.length === 0) return;
  if (keys.length === 1) {
    await saveImpostazioniField(manifestationId, keys[0], partialFields[keys[0]]);
    return;
  }
  await ensureImpostazioniDocument(manifestationId);
  const docRef = impostazioniDocRef(manifestationId);
  await updateDoc(docRef, partialFields);
}

export async function patchImpostazioni(manifestationId, fields) {
  return updateImpostazioniDocument(manifestationId, fields);
}

/** Solo per nuova manifestazione: documento iniziale completo. */
export async function createImpostazioniDocument(manifestationId, initialData) {
  const docRef = impostazioniDocRef(manifestationId);
  await setDoc(docRef, { manifestationId, ...initialData }, { merge: true });
}
