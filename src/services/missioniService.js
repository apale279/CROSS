import {
  addDoc,
  collection,
  deleteField,
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
import { allocateProgressiveId } from './progressiveIdService';
import { patchMezzo } from './mezziService';
import { tryAutoCloseEventoForMissione } from './eventoAutoCloseService';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { pickGravestColore, normalizeCodiceColore } from '../lib/codiciColore';
import { ESITO_MISSIONE_DEFAULT } from '../lib/missioneEsito';
import { MISSIONE_ECCEZIONE_MOTIVO, MEZZO_STATO_AVARIA_SINISTRO } from '../lib/missionEccezioni';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { missioniRientroAperteSuMezzo } from '../lib/mezzoMissione';
import { fetchPazientiTrasportoOnMezzo, pazienteSameEventoAsMissione } from '../lib/pazientiTrasportoQuery';
import { patchPaziente } from './pazientiService';
import { syncPazientiArrivatoH } from './pazientiService';
import { syncPazientiPmaOnDirettoH } from './pazientePmaMissionSync';
import { notifyTelegramStatoFromCentrale } from './telegramService';

/** Un solo ingaggio attivo per mezzo: chiude le missioni in RIENTRO/ARRIVATO H prima del nuovo evento. */
async function terminaMissioniRientroPrecedenti(manifestationId, mezzoSigla, existingMissioni) {
  const precedenti = missioniRientroAperteSuMezzo(existingMissioni ?? [], mezzoSigla);
  for (const mis of precedenti) {
    await patchMissione(
      manifestationId,
      mis._docId,
      buildStatoChangeFields(mis, 'FINE MISSIONE'),
      mis.mezzo,
    );
  }
}

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
  if (payload.mezzo) {
    await terminaMissioniRientroPrecedenti(manifestationId, payload.mezzo, existingMissioni);
  }

  const idMissione = await allocateProgressiveId(
    manifestationId,
    'M',
    'missioni',
    existingMissioni,
    'idMissione',
  );
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
  const coloreMissione = normalizeCodiceColore(
    payload.codiceColoreMissione ?? payload.coloreEvento ?? 'Bianco',
  );
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
    noteMissione: payload.noteMissione ?? '',
    tratteMissione: [],
    codiceColoreMissione: coloreMissione,
    esitoMissione: ESITO_MISSIONE_DEFAULT,
  });
  await patchMezzo(manifestationId, payload.mezzo, { statoMezzo: 'Non disponibile' });
  return { docId: docRef.id, idMissione, idUnivoco };
}

const COLORI_VALIDI = new Set(DEFAULT_IMPOSTAZIONI.coloriEvento);

async function findMissioneDocForPaziente(manifestationId, paziente) {
  const colRef = collection(db, ...missioniPath(manifestationId));
  if (paziente.missioneIdUnivoco) {
    const q = query(colRef, where('idUnivoco', '==', paziente.missioneIdUnivoco), limit(4));
    const snap = await getDocs(q);
    const hit = snap.docs.find((d) => d.data().aperta !== false) ?? snap.docs[0];
    if (hit) return { id: hit.id, data: hit.data() };
  }
  if (paziente.idMissione && paziente.mezzo) {
    const q = query(colRef, where('idMissione', '==', paziente.idMissione), limit(24));
    const snap = await getDocs(q);
    const open = snap.docs.find((d) => {
      const x = d.data();
      return x.mezzo === paziente.mezzo && x.aperta !== false;
    });
    if (open) return { id: open.id, data: open.data() };
  }
  return null;
}

/** Ricalcola codice colore trasporto dai pazienti in trasporto sul mezzo (se non impostato manualmente). */
export async function refreshMissioneCodiceColoreTrasporto(manifestationId, missionDocId, missione) {
  if (!missionDocId || !missione || missione.codiceColoreTrasportoManuale === true) return;
  const candidati = missione.mezzo
    ? await fetchPazientiTrasportoOnMezzo(manifestationId, missione.mezzo)
    : [];
  const colori = [];
  for (const p of candidati) {
    if (!pazienteSameEventoAsMissione(p, missione)) continue;
    const c = String(p.codiceColoreSanitario ?? '').trim();
    if (c && COLORI_VALIDI.has(c)) colori.push(c);
  }
  if (colori.length) {
    await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), {
      codiceColoreTrasporto: pickGravestColore(colori),
      codiceColoreTrasportoManuale: false,
    });
    return;
  }
  await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), {
    codiceColoreTrasporto: deleteField(),
    codiceColoreTrasportoManuale: deleteField(),
  });
}

/**
 * Allinea colore sanitario paziente e codice trasporto missione (valutazione MSB/MSA).
 */
export async function patchMissioneCodiceColoreFromPaziente(manifestationId, paziente, codiceColore) {
  if (!manifestationId || !paziente) return;

  const esplicito =
    codiceColore != null && codiceColore !== '' && COLORI_VALIDI.has(codiceColore);

  if (paziente._docId) {
    await patchPaziente(
      manifestationId,
      paziente._docId,
      esplicito
        ? { codiceColoreSanitario: codiceColore }
        : { codiceColoreSanitario: deleteField() },
    );
  }

  const hit = await findMissioneDocForPaziente(manifestationId, paziente);
  if (!hit || hit.data.codiceColoreTrasportoManuale === true) return;
  await refreshMissioneCodiceColoreTrasporto(manifestationId, hit.id, hit.data);
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
  if (fields.stato === 'RIENTRO' && mezzoSigla) {
    await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
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
    if (fields.stato === 'DIRETTO H') {
      const misSnap = await getDoc(docRef);
      if (misSnap.exists()) {
        await syncPazientiPmaOnDirettoH(manifestationId, {
          _docId: misSnap.id,
          ...misSnap.data(),
        });
      }
    }
  }
}
