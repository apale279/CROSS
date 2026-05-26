import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { mezziPath } from '../lib/firestorePaths';
import { normalizeMezzoKey } from '../lib/mezzoMissione';
import { omitUndefinedFields } from '../lib/firestorePatch';
import { newIdUnivoco } from '../lib/ids';

/** Doc id mezzi in Firestore (gestisce BRAVO_1 vs BRAVO1). */
export async function resolveMezzoDocIdFirestore(manifestationId, siglaRaw) {
  const key = String(siglaRaw ?? '').trim();
  if (!key) return '';
  const exactRef = doc(db, ...mezziPath(manifestationId), key);
  const exactSnap = await getDoc(exactRef);
  if (exactSnap.exists()) return exactSnap.id;

  const nk = normalizeMezzoKey(key);
  if (!nk) return key;
  const snap = await getDocs(collection(db, ...mezziPath(manifestationId)));
  for (const d of snap.docs) {
    const data = d.data();
    const sigla = String(data.sigla ?? d.id ?? '').trim();
    if (normalizeMezzoKey(sigla) === nk || normalizeMezzoKey(d.id) === nk) {
      return sigla || d.id;
    }
  }
  return key;
}

const emptyPerson = () => ({ nome: '', cognome: '', telefono: '' });

export const emptyEquipaggio = () => ({
  autista: emptyPerson(),
  medico: emptyPerson(),
  soccorritore1: emptyPerson(),
  soccorritore2: emptyPerson(),
});

export async function createMezzo(manifestationId, sigla, payload) {
  const docRef = doc(db, ...mezziPath(manifestationId), sigla);
  await setDoc(
    docRef,
    {
      manifestationId,
      idUnivoco: newIdUnivoco(),
      sigla,
      tipo: payload.tipo ?? '',
      stazionamento: payload.stazionamento ?? { indirizzo: '', coordinate: null, luogo_fisico: '' },
      coordinate_stazionamento: null,
      dettaglio_stazionamento: '',
      stazionamentoPredefinito: payload.stazionamentoPredefinito ?? false,
      targa: payload.targa ?? '',
      radio: payload.radio ?? '',
      statoMezzo: 'Disponibile',
      equipaggio: payload.equipaggio ?? emptyEquipaggio(),
      operativo: true,
      noteOperativo: '',
      creatoIl: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function patchMezzo(manifestationId, sigla, fields) {
  const payload = omitUndefinedFields(fields);
  if (!sigla || Object.keys(payload).length === 0) return;
  const docId = await resolveMezzoDocIdFirestore(manifestationId, sigla);
  const docRef = doc(db, ...mezziPath(manifestationId), docId);
  await updateDoc(docRef, payload);
}

export async function deleteMezzo(manifestationId, sigla) {
  await deleteDoc(doc(db, ...mezziPath(manifestationId), sigla));
}
