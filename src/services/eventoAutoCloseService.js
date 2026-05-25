import { collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath, missioniPath, pazientiPath } from '../lib/firestorePaths';
import { pazientiPerEvento } from '../lib/eventoLinks';
import { shouldAutoCloseEvento } from '../utils/eventoAutoClose';
import { patchEvento } from './eventiService';

export async function tryAutoCloseEvento(manifestationId, eventoRef) {
  if (!eventoRef?.idUnivoco && !eventoRef?.idEvento) return;

  let missioni = [];

  if (eventoRef.idUnivoco) {
    const snap = await getDocs(
      query(
        collection(db, ...missioniPath(manifestationId)),
        where('eventoIdUnivoco', '==', eventoRef.idUnivoco),
      ),
    );
    missioni = snap.docs.map((d) => d.data());
  } else {
    const snap = await getDocs(
      query(
        collection(db, ...missioniPath(manifestationId)),
        where('eventoCorrelato', '==', eventoRef.idEvento),
      ),
    );
    missioni = snap.docs.map((d) => d.data());
  }

  let pazienti = [];
  const pazSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  pazienti = pazSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

  let eventoDoc;
  if (eventoRef.docId) {
    const ref = doc(db, ...eventiPath(manifestationId), eventoRef.docId);
    const s = await getDoc(ref);
    if (s.exists()) eventoDoc = { id: s.id, ...s.data() };
  }
  if (!eventoDoc && eventoRef.idUnivoco) {
    const snap = await getDocs(
      query(
        collection(db, ...eventiPath(manifestationId)),
        where('idUnivoco', '==', eventoRef.idUnivoco),
      ),
    );
    if (!snap.empty) eventoDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  if (!eventoDoc && eventoRef.idEvento) {
    const snap = await getDocs(
      query(
        collection(db, ...eventiPath(manifestationId)),
        where('idEvento', '==', eventoRef.idEvento),
      ),
    );
    if (!snap.empty) eventoDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  if (!eventoDoc || eventoDoc.stato === false || eventoDoc.operativoTerminato === true) return;

  const pazientiEvento = pazientiPerEvento(pazienti, {
    idUnivoco: eventoDoc.idUnivoco,
    idEvento: eventoDoc.idEvento,
  });
  if (!shouldAutoCloseEvento(missioni, pazientiEvento)) return;

  await patchEvento(manifestationId, eventoDoc.id, {
    operativoTerminato: true,
    operativoTerminatoIl: serverTimestamp(),
  });
}

export async function tryAutoCloseEventoForMissione(manifestationId, missioneDocId) {
  const misSnap = await getDoc(doc(db, ...missioniPath(manifestationId), missioneDocId));
  if (!misSnap.exists()) return;
  const m = misSnap.data();
  await tryAutoCloseEvento(manifestationId, {
    docId: null,
    idUnivoco: m.eventoIdUnivoco,
    idEvento: m.eventoCorrelato,
  });
}
