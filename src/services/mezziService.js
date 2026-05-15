import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { mezziPath } from '../lib/firestorePaths';
import { newIdUnivoco } from '../lib/ids';

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
      stazionamento: payload.stazionamento ?? { indirizzo: '', coordinate: null },
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
  if (!sigla || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...mezziPath(manifestationId), sigla);
  await updateDoc(docRef, fields);
}

export async function deleteMezzo(manifestationId, sigla) {
  await deleteDoc(doc(db, ...mezziPath(manifestationId), sigla));
}
