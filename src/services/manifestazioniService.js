import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { impostazioniPath, manifestazioniCollection } from '../lib/firestorePaths';

function toTimestamp(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

export async function createManifestazione({ nome, dataInizio, luogo }) {
  const colRef = collection(db, ...manifestazioniCollection());
  const docRef = await addDoc(colRef, {
    nome: nome.trim(),
    dataInizio: toTimestamp(dataInizio),
    luogo: luogo.trim(),
    creatoIl: serverTimestamp(),
  });
  await setDoc(doc(db, ...impostazioniPath(docRef.id)), {
    ...DEFAULT_IMPOSTAZIONI,
    manifestationId: docRef.id,
  });
  return docRef.id;
}

export async function deleteManifestazione(manifestationId) {
  await deleteDoc(doc(db, ...manifestazioniCollection(), manifestationId));
}
