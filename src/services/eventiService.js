import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath, missioniPath, pazientiPath } from '../lib/firestorePaths';
import { deletePazienteCascade } from './pazientiService';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { mezzoHaMissioneAttiva } from '../lib/mezzoMissione';
import { MEZZO_STATO_DISPONIBILE } from '../lib/mezzoStati';
import { isMissioneTerminata } from '../utils/eventoAutoClose';
import { newIdUnivoco } from '../lib/ids';
import { allocateProgressiveId } from './progressiveIdService';
import { patchMissione } from './missioniService';
import { patchMezzo } from './mezziService';

async function flushBatchDeletes(refs) {
  if (!refs.length) return;
  let batch = writeBatch(db);
  let ops = 0;
  for (const ref of refs) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

function buildEventoPayload(manifestationId, idEvento, idUnivoco, payload) {
  const data = {
    manifestationId,
    idUnivoco,
    idEvento,
    apertura: serverTimestamp(),
    stato: true,
    indirizzo: payload.indirizzo ?? '',
    luogo_fisico: payload.luogo_fisico ?? '',
    chiamante: payload.chiamante ?? '',
    tipoEvento: payload.tipoEvento ?? '',
    dettaglioEvento: payload.dettaglioEvento ?? '',
    luogo: payload.luogo ?? '',
    tipoLuogo: payload.tipoLuogo ?? '',
    meteo: payload.meteo ?? '',
    colore: payload.colore ?? 'Bianco',
    noteEvento: payload.noteEvento ?? '',
  };
  if (payload.coordinate != null) {
    data.coordinate = payload.coordinate;
  }
  if (payload.eventoGenitoreIdUnivoco) {
    data.eventoGenitoreIdUnivoco = payload.eventoGenitoreIdUnivoco;
  }
  if (payload.eventoGenitoreCorrelato != null && payload.eventoGenitoreCorrelato !== '') {
    data.eventoGenitoreCorrelato = payload.eventoGenitoreCorrelato;
  }
  if (payload.origineEccezione) {
    data.origineEccezione = payload.origineEccezione;
  }
  return data;
}

async function deleteRecordiCollegati(manifestationId, idUnivoco, idEvento) {
  const [missioniSnap, pazientiSnap] = await Promise.all([
    getDocs(collection(db, ...missioniPath(manifestationId))),
    getDocs(collection(db, ...pazientiPath(manifestationId))),
  ]);

  const delMissioni = missioniSnap.docs.filter((d) => {
    const m = d.data();
    if (idUnivoco && m.eventoIdUnivoco) return m.eventoIdUnivoco === idUnivoco;
    return m.eventoCorrelato === idEvento;
  });

  const delPazienti = pazientiSnap.docs.filter((d) => {
    const p = d.data();
    if (idUnivoco && p.eventoIdUnivoco) return p.eventoIdUnivoco === idUnivoco;
    return p.eventoCorrelato === idEvento;
  });

  const deletedMissionIds = new Set(delMissioni.map((d) => d.id));
  const mezziCoinvolti = [
    ...new Set(delMissioni.map((d) => d.data().mezzo).filter(Boolean)),
  ];
  const missioniRimanenti = missioniSnap.docs
    .filter((d) => !deletedMissionIds.has(d.id))
    .map((d) => ({ _docId: d.id, ...d.data() }));

  await flushBatchDeletes(delMissioni.map((d) => d.ref));

  for (const sigla of mezziCoinvolti) {
    if (!mezzoHaMissioneAttiva(sigla, missioniRimanenti)) {
      await patchMezzo(manifestationId, sigla, { statoMezzo: MEZZO_STATO_DISPONIBILE });
    }
  }

  for (const d of delPazienti) {
    await deletePazienteCascade(manifestationId, d.id);
  }
}

export async function createEvento(manifestationId, payload, existingEventi) {
  const idEvento = await allocateProgressiveId(
    manifestationId,
    'E',
    'eventi',
    existingEventi,
    'idEvento',
  );
  const idUnivoco = newIdUnivoco();
  const colRef = collection(db, ...eventiPath(manifestationId));
  const docRef = await addDoc(
    colRef,
    buildEventoPayload(manifestationId, idEvento, idUnivoco, payload),
  );
  return { docId: docRef.id, idEvento, idUnivoco };
}

export async function patchEvento(manifestationId, docId, fields) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...eventiPath(manifestationId), docId);
  await updateDoc(docRef, fields);
}

/** Chiusura manuale dopo fase operativa terminata (rimozione da dashboard). */
export async function terminaEventoOperatore(manifestationId, eventoDocId) {
  await patchEvento(manifestationId, eventoDocId, {
    stato: false,
    chiusuraIl: serverTimestamp(),
  });
}

/**
 * Chiusura forzata evento: note obbligatorie, tutte le missioni collegate → FINE MISSIONE + mezzi liberi.
 */
export async function closeEventoForzato(
  manifestationId,
  eventoDocId,
  missioniCollegate,
  noteChiusura,
  tipoChiusuraEvento,
) {
  const note = noteChiusura?.trim();
  if (!note) {
    throw new Error('Inserisci una nota che spiega il motivo della chiusura.');
  }
  if (!eventoDocId) {
    throw new Error('Evento non valido.');
  }

  const closeMissioni = (missioniCollegate ?? [])
    .filter((mis) => !isMissioneTerminata(mis) || mis.aperta !== false)
    .map((mis) => {
      const fields =
        mis.stato === 'FINE MISSIONE'
          ? { aperta: false }
          : buildStatoChangeFields(mis, 'FINE MISSIONE');
      return patchMissione(manifestationId, mis._docId, fields, mis.mezzo);
    });

  await Promise.all(closeMissioni);

  await patchEvento(manifestationId, eventoDocId, {
    stato: false,
    noteChiusura: note,
    chiusuraIl: serverTimestamp(),
    ...(tipoChiusuraEvento ? { tipoChiusuraEvento } : {}),
  });
}

export async function deleteEvento(manifestationId, docId) {
  const docRef = doc(db, ...eventiPath(manifestationId), docId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const { idUnivoco, idEvento } = snap.data();
    await deleteRecordiCollegati(manifestationId, idUnivoco, idEvento);
  }
  await deleteDoc(docRef);
}
