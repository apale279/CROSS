import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { missioniPath } from '../lib/firestorePaths';
import { newIdUnivoco } from '../lib/ids';
import { nextProgressiveId } from './idGenerator';
import { patchMezzo } from './mezziService';
import { tryAutoCloseEventoForMissione } from './eventoAutoCloseService';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { MISSIONE_ECCEZIONE_MOTIVO, MEZZO_STATO_AVARIA_SINISTRO } from '../lib/missionEccezioni';
import { syncPazientiArrivatoH } from './pazientiService';
import { notifyTelegramStatoFromCentrale } from './telegramService';

function formatEquipaggio(equipaggio) {
  if (!equipaggio) return '';
  const roles = [
    ['Autista', equipaggio.autista],
    ['Medico/CE', equipaggio.medico],
    ['Soccorritore 1', equipaggio.soccorritore1],
    ['Soccorritore 2', equipaggio.soccorritore2],
  ];
  return roles
    .map(([label, p]) => {
      if (!p?.nome && !p?.cognome) return null;
      const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
      const tel = p.telefono ? ` — ${p.telefono}` : '';
      return `${label}: ${nome}${tel}`;
    })
    .filter(Boolean)
    .join(' | ');
}

export async function createMissione(manifestationId, payload, existingMissioni, mezzo) {
  const idMissione = nextProgressiveId('M', existingMissioni, 'idMissione');
  const idUnivoco = newIdUnivoco();
  const autopresentato = !!payload.pazienteAutopresentato;
  const forzato = payload.statoInizialeForzato;
  const statiAmmessi = DEFAULT_IMPOSTAZIONI.statiMissione;
  const statoIniziale =
    forzato && statiAmmessi.includes(forzato)
      ? forzato
      : autopresentato
        ? 'IN POSTO'
        : 'ALLERTARE';
  const colRef = collection(db, ...missioniPath(manifestationId));
  const docRef = await addDoc(colRef, {
    manifestationId,
    idUnivoco,
    idMissione,
    eventoIdUnivoco: payload.eventoIdUnivoco,
    eventoCorrelato: payload.eventoCorrelato,
    mezzo: payload.mezzo,
    stato: statoIniziale,
    statoDa: serverTimestamp(),
    storicoStati: { [statoIniziale]: serverTimestamp() },
    pazienteAutopresentato: autopresentato,
    equipaggio: formatEquipaggio(mezzo?.equipaggio),
    aperta: true,
    apertura: serverTimestamp(),
    noteMissione: '',
    tratteMissione: [],
  });
  await patchMezzo(manifestationId, payload.mezzo, { statoMezzo: 'Non disponibile' });
  return { docId: docRef.id, idMissione, idUnivoco };
}

const COLORI_VALIDI = new Set(DEFAULT_IMPOSTAZIONI.coloriEvento);

/**
 * Allinea `codiceColore` sulla missione collegata al paziente (valutazione MSB).
 */
export async function patchMissioneCodiceColoreFromPaziente(manifestationId, paziente, codiceColore) {
  if (!manifestationId || !paziente || codiceColore == null || codiceColore === '') return;
  if (!COLORI_VALIDI.has(codiceColore)) return;

  const colRef = collection(db, ...missioniPath(manifestationId));
  let missionDocId = null;

  if (paziente.missioneIdUnivoco) {
    const q = query(colRef, where('idUnivoco', '==', paziente.missioneIdUnivoco), limit(4));
    const snap = await getDocs(q);
    const hit = snap.docs.find((d) => d.data().aperta !== false) ?? snap.docs[0];
    if (hit) missionDocId = hit.id;
  }

  if (!missionDocId && paziente.idMissione && paziente.mezzo) {
    const q = query(colRef, where('idMissione', '==', paziente.idMissione), limit(24));
    const snap = await getDocs(q);
    const open = snap.docs.find((d) => {
      const x = d.data();
      return x.mezzo === paziente.mezzo && x.aperta !== false;
    });
    if (open) missionDocId = open.id;
  }

  if (!missionDocId) return;
  await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), {
    codiceColore,
  });
}

export async function patchMissione(manifestationId, docId, fields, mezzoSigla) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...missioniPath(manifestationId), docId);
  const payload = { ...fields };
  if (fields.stato != null) {
    payload.statoDa = serverTimestamp();
  }
  await updateDoc(docRef, payload);
  if (fields.stato === 'ARRIVATO H') {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await syncPazientiArrivatoH(manifestationId, { _docId: snap.id, ...snap.data() });
    }
  }
  if (fields.stato === 'FINE MISSIONE' && mezzoSigla) {
    await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
  }
  if (fields.stato === 'ANNULLATA' && mezzoSigla) {
    const motivo = fields.missioneEccezioneMotivo;
    if (motivo === MISSIONE_ECCEZIONE_MOTIVO.AVARIA_SINISTRO) {
      await patchMezzo(manifestationId, mezzoSigla, {
        statoMezzo: MEZZO_STATO_AVARIA_SINISTRO,
        operativo: false,
      });
    } else {
      await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
    }
  }
  if (fields.stato != null || fields.aperta != null) {
    await tryAutoCloseEventoForMissione(manifestationId, docId);
  }
  if (fields.stato != null) {
    notifyTelegramStatoFromCentrale(manifestationId, docId);
  }
}
