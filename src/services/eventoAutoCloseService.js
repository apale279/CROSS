import { collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath, missioniPath, pazientiPath } from '../lib/firestorePaths';
import { missioniPerEvento, pazientiPerEvento } from '../lib/eventoLinks';
import { shouldAutoCloseEvento } from '../utils/eventoAutoClose';
import { patchEvento } from './eventiService';

async function resolveEventoDoc(manifestationId, eventoRef) {
  let byDocId = null;
  let byUid = null;
  let byDisplay = null;

  if (eventoRef.docId) {
    const ref = doc(db, ...eventiPath(manifestationId), eventoRef.docId);
    const s = await getDoc(ref);
    if (s.exists()) byDocId = { id: s.id, ...s.data() };
  }
  if (eventoRef.idUnivoco) {
    const snap = await getDocs(
      query(collection(db, ...eventiPath(manifestationId)), where('idUnivoco', '==', eventoRef.idUnivoco)),
    );
    if (!snap.empty) byUid = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  if (eventoRef.idEvento) {
    const snap = await getDocs(
      query(collection(db, ...eventiPath(manifestationId)), where('idEvento', '==', eventoRef.idEvento)),
    );
    if (!snap.empty) byDisplay = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  if (byDocId) return byDocId;
  if (byUid && byDisplay) {
    return byUid.id === byDisplay.id ? byUid : byDisplay;
  }
  return byUid ?? byDisplay ?? null;
}

export async function tryAutoCloseEvento(manifestationId, eventoRef) {
  if (!eventoRef?.idUnivoco && !eventoRef?.idEvento) return;

  const missioniCol = collection(db, ...missioniPath(manifestationId));
  const missionSnaps = await Promise.all([
    eventoRef.idUnivoco
      ? getDocs(query(missioniCol, where('eventoIdUnivoco', '==', eventoRef.idUnivoco)))
      : Promise.resolve({ docs: [] }),
    eventoRef.idEvento
      ? getDocs(query(missioniCol, where('eventoCorrelato', '==', eventoRef.idEvento)))
      : Promise.resolve({ docs: [] }),
  ]);
  const missioniById = new Map();
  for (const snap of missionSnaps) {
    for (const d of snap.docs) {
      missioniById.set(d.id, { _docId: d.id, ...d.data() });
    }
  }
  let missioni = [...missioniById.values()];

  let pazienti = [];
  const pazSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  pazienti = pazSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

  const eventoDoc = await resolveEventoDoc(manifestationId, eventoRef);

  if (!eventoDoc || eventoDoc.stato === false || eventoDoc.operativoTerminato === true) return;
  if (eventoDoc.operativoAutoCloseSospeso === true) return;

  const eventoForLink = {
    idUnivoco: eventoDoc.idUnivoco,
    idEvento: eventoDoc.idEvento,
  };
  missioni = missioniPerEvento(missioni, eventoForLink);
  const pazientiEvento = pazientiPerEvento(pazienti, eventoForLink);
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
