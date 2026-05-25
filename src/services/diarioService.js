import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { noteDiarioPath } from '../lib/firestorePaths';

export async function createNotaDiario(manifestationId, payload) {
  const colRef = collection(db, ...noteDiarioPath(manifestationId));
  const docRef = await addDoc(colRef, {
    manifestationId,
    titolo: (payload.titolo ?? '').trim(),
    testo: (payload.testo ?? '').trim(),
    aperta: true,
    importante: !!payload.importante,
    pdfUrl: (payload.pdfUrl ?? '').trim() || null,
    pdfFilename: (payload.pdfFilename ?? '').trim() || null,
    creatoIl: serverTimestamp(),
    aggiornatoIl: serverTimestamp(),
  });
  return { docId: docRef.id };
}

export async function patchNotaDiario(manifestationId, docId, fields) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...noteDiarioPath(manifestationId), docId);
  await updateDoc(docRef, {
    ...fields,
    aggiornatoIl: serverTimestamp(),
  });
}

export async function deleteNotaDiario(manifestationId, docId) {
  await deleteDoc(doc(db, ...noteDiarioPath(manifestationId), docId));
}
