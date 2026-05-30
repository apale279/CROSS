import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { pazientiPath } from './firestorePaths';
import { omitUndefinedFields } from './firestorePatch';
import { mergeSchedaArrayById } from '../pma/lib/pmaSchedaArrayMerge';

/** Converte patch codice minore in path puntati (mai `codiceMinore` intero). */
export function flattenCodiceMinorePatch(topLevel = {}, codiceMinorePartial = null) {
  const fields = { ...topLevel };
  if (codiceMinorePartial && typeof codiceMinorePartial === 'object') {
    for (const [key, value] of Object.entries(codiceMinorePartial)) {
      if (key === 'foto') continue;
      fields[`codiceMinore.${key}`] = value;
    }
  }
  return fields;
}

/** Aggiorna campi scalari codice minore (path puntati). */
export async function patchPazienteCodiceMinoreScalars(manifestationId, docId, topLevel, codiceMinorePartial) {
  if (!manifestationId || !docId) return;
  const fields = omitUndefinedFields(flattenCodiceMinorePatch(topLevel, codiceMinorePartial));
  if (Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await updateDoc(docRef, fields);
}

/** Scrive `codiceMinore.foto` con merge transazionale per `id`. */
export async function patchPazienteCodiceMinoreFoto(manifestationId, docId, fotoList) {
  if (!manifestationId || !docId) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Codice minore non trovato');
    const serverFoto = snap.data()?.codiceMinore?.foto;
    const merged = mergeSchedaArrayById(
      Array.isArray(serverFoto) ? serverFoto : [],
      Array.isArray(fotoList) ? fotoList : [],
    );
    transaction.update(docRef, { 'codiceMinore.foto': merged });
  });
}

/** Aggiunge una foto in transazione (append atomico). */
export async function appendPazienteCodiceMinoreFoto(manifestationId, docId, newFotoEntry) {
  if (!manifestationId || !docId || !newFotoEntry?.id) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Codice minore non trovato');
    const serverFoto = snap.data()?.codiceMinore?.foto;
    const list = Array.isArray(serverFoto) ? [...serverFoto] : [];
    list.push(newFotoEntry);
    transaction.update(docRef, { 'codiceMinore.foto': list });
  });
}

/** Rimuove una foto per `id` in transazione. */
export async function removePazienteCodiceMinoreFoto(manifestationId, docId, fotoId) {
  if (!manifestationId || !docId || !fotoId) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Codice minore non trovato');
    const serverFoto = snap.data()?.codiceMinore?.foto;
    const merged = (Array.isArray(serverFoto) ? serverFoto : []).filter((f) => f?.id !== fotoId);
    transaction.update(docRef, { 'codiceMinore.foto': merged });
  });
}
