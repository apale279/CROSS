import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { mezziPath, missioniPath } from '../lib/firestorePaths';
import { formatEquipaggioText } from '../lib/missionEquipaggio';
import { newIdUnivoco } from '../lib/ids';
import { allocateProgressiveId } from './progressiveIdService';
import { omitUndefinedFields } from '../lib/firestorePatch';
import {
  isStatoMissioneRientroOLiberato,
  missioneBloccaMezzo,
  missioniAperteSuMezzo,
  missioniRientroAperteSuMezzo,
  normalizeMezzoKey,
} from '../lib/mezzoMissione';
import { MezzoRientroMissioneApertaError } from '../lib/missioneRientroCreate';
import { patchMezzo, resolveMezzoDocIdFirestore } from './mezziService';
import { tryAutoCloseEventoForMissione } from './eventoAutoCloseService';
import { normalizeImpostazioni } from '../lib/impostazioniNormalize';
import { coloriEventoValidiSet, resolveStatiMissione } from '../lib/impostazioniLists';
import { pickGravestColore, parseCodiceColoreOptional } from '../lib/codiciColore';
import { mergeOperatoreCreatoPayload, stripOperatoreCreatoFromPatch } from '../lib/operatoreAudit';
import { impostazioniDocRef } from './impostazioniService';
import { ESITO_MISSIONE_DEFAULT } from '../lib/missioneEsito';
import { MISSIONE_ECCEZIONE_MOTIVO, MEZZO_STATO_AVARIA_SINISTRO } from '../lib/missionEccezioni';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { mergeTratteMissioneWrite } from '../lib/missionTratte';
import { fetchPazientiTrasportoForMissione } from '../lib/pazientiTrasportoQuery';
import { patchPaziente } from './pazientiService';
import { syncPazientiArrivatoH } from './pazientiService';
import {
  isMissionePmaInvioPs,
} from '../lib/pmaInvioPsMission';
import { syncPazientiPmaOnDirettoH, syncPmaCodiceColoreFromSanitario } from './pazientePmaMissionSync';
import { notifyTelegramStatoFromCentrale } from './telegramService';

function assertMezzoLiberoPerNuovaMissione(mezzoSigla, existingMissioni, { chiudiMissioniRientro }) {
  if (!mezzoSigla) return;
  const aperte = missioniAperteSuMezzo(existingMissioni ?? [], mezzoSigla);
  const bloccanti = aperte.filter((m) => missioneBloccaMezzo(m));
  const rientro = aperte.filter((m) => isStatoMissioneRientroOLiberato(m.stato));

  if (chiudiMissioniRientro) {
    if (bloccanti.length > 0) {
      const m = bloccanti[0];
      throw new Error(
        `Il mezzo ${mezzoSigla} ha già la missione aperta ${m.idMissione ?? '—'} (${m.stato ?? ''}). ` +
          'Chiudi quella missione prima di ingaggiare di nuovo lo stesso mezzo.',
      );
    }
    return;
  }

  if (rientro.length > 0) {
    throw new MezzoRientroMissioneApertaError(mezzoSigla, rientro[0]);
  }
  if (bloccanti.length > 0) {
    const m = bloccanti[0];
    throw new Error(
      `Il mezzo ${mezzoSigla} ha già la missione aperta ${m.idMissione ?? '—'} (${m.stato ?? ''}). ` +
        'Chiudi o termina quella missione prima di crearne un\'altra sullo stesso mezzo.',
    );
  }
}

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

/** Equipaggio del mezzo al momento dell’ingaggio (da Firestore se non passato in memoria). */
async function equipaggioTestoAlLegameMezzo(manifestationId, mezzoSigla, mezzoInMemoria) {
  if (!mezzoSigla) return '';
  let record = mezzoInMemoria;
  if (!record?.equipaggio) {
    const docId = await resolveMezzoDocIdFirestore(manifestationId, mezzoSigla);
    if (docId) {
      const snap = await getDoc(doc(db, ...mezziPath(manifestationId), docId));
      if (snap.exists()) record = { _docId: snap.id, ...snap.data() };
    }
  }
  return formatEquipaggioText(record?.equipaggio);
}

export async function createMissione(manifestationId, payload, existingMissioni, mezzo) {
  const mezzoSiglaEarly = payload.mezzo
    ? await resolveMezzoDocIdFirestore(manifestationId, payload.mezzo)
    : '';
  let missionPayload = payload;
  if (mezzoSiglaEarly) {
    const aperte = missioniAperteSuMezzo(existingMissioni ?? [], mezzoSiglaEarly);
    const rientro = aperte.filter((m) => isStatoMissioneRientroOLiberato(m.stato));
    if (rientro.length > 0 && !payload.chiudiMissioniRientro) {
      missionPayload = { ...payload, chiudiMissioniRientro: true };
    }
    assertMezzoLiberoPerNuovaMissione(mezzoSiglaEarly, existingMissioni, {
      chiudiMissioniRientro: !!missionPayload.chiudiMissioniRientro,
    });
    await terminaMissioniRientroPrecedenti(manifestationId, mezzoSiglaEarly, existingMissioni);
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
  const impSnap = await getDoc(impostazioniDocRef(manifestationId));
  const imp = impSnap.exists() ? normalizeImpostazioni(impSnap.data()) : null;
  const statiAmmessi = resolveStatiMissione(imp);
  const statoIniziale =
    forzato && statiAmmessi.includes(forzato)
      ? forzato
      : autopresentato
        ? 'IN POSTO'
        : 'ALLERTARE';
  const coloreMissione = parseCodiceColoreOptional(payload.codiceColoreMissione);
  const ospedaleDest = String(payload.ospedaleDestinazione ?? '').trim();
  const mezzoSigla = mezzoSiglaEarly;
  const equipaggio = await equipaggioTestoAlLegameMezzo(manifestationId, mezzoSigla, mezzo);
  const colRef = collection(db, ...missioniPath(manifestationId));
  const docRef = await addDoc(colRef, {
    manifestationId,
    idUnivoco,
    idMissione,
    eventoIdUnivoco: payload.eventoIdUnivoco,
    eventoCorrelato: payload.eventoCorrelato,
    mezzo: mezzoSigla,
    stato: statoIniziale,
    statoDa: serverTimestamp(),
    storicoStati: { [statoIniziale]: serverTimestamp() },
    pazienteAutopresentato: autopresentato,
    equipaggio,
    aperta: true,
    apertura: serverTimestamp(),
    noteMissione: payload.noteMissione ?? '',
    tratteMissione: [],
    ...(coloreMissione ? { codiceColoreMissione: coloreMissione } : {}),
    esitoMissione: ESITO_MISSIONE_DEFAULT,
    ...(payload.tipoTrasporto ? { tipoTrasporto: payload.tipoTrasporto } : {}),
    ...(payload.pazienteRiferimento ? { pazienteRiferimento: payload.pazienteRiferimento } : {}),
    ...(ospedaleDest ? { ospedaleDestinazione: ospedaleDest } : {}),
    ...mergeOperatoreCreatoPayload(payload),
  });
  if (mezzoSigla) {
    await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Non disponibile' });
  }
  return { docId: docRef.id, idMissione, idUnivoco };
}

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
    const nk = normalizeMezzoKey(paziente.mezzo);
    const open = snap.docs.find((d) => {
      const x = d.data();
      return (
        x.aperta !== false &&
        x.mezzo &&
        nk &&
        normalizeMezzoKey(x.mezzo) === nk
      );
    });
    if (open) return { id: open.id, data: open.data() };
  }
  return null;
}

/**
 * Ricalcola codice T dai pazienti in trasporto sul mezzo.
 * `forceFromPaziente`: ignora T manuale (il codice colore paziente detta sempre legge su T).
 */
export async function refreshMissioneCodiceColoreTrasporto(
  manifestationId,
  missionDocId,
  missione,
  { forceFromPaziente = false } = {},
) {
  if (!missionDocId || !missione) return;
  if (isMissionePmaInvioPs(missione)) return;
  if (!forceFromPaziente && missione.codiceColoreTrasportoManuale === true) return;
  const impSnap = await getDoc(impostazioniDocRef(manifestationId));
  const coloriValidi = coloriEventoValidiSet(
    impSnap.exists() ? normalizeImpostazioni(impSnap.data()) : null,
  );
  const candidati = missione.mezzo
    ? await fetchPazientiTrasportoForMissione(manifestationId, missione)
    : [];
  const colori = [];
  for (const p of candidati) {
    const c = String(p.codiceColoreSanitario ?? '').trim();
    if (c && coloriValidi.has(c)) colori.push(c);
  }
  if (colori.length) {
    const update = { codiceColoreTrasporto: pickGravestColore(colori) };
    if (!(forceFromPaziente && missione.codiceColoreTrasportoManuale === true)) {
      update.codiceColoreTrasportoManuale = false;
    }
    await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), update);
    return;
  }
  if (forceFromPaziente && missione.codiceColoreTrasportoManuale === true) return;
  await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), {
    codiceColoreTrasporto: deleteField(),
    codiceColoreTrasportoManuale: deleteField(),
  });
}

/** Allinea codice T missione dal codice colore sanitario del paziente collegato. */
export async function syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, paziente) {
  if (!manifestationId || !paziente) return;
  const colore = parseCodiceColoreOptional(paziente.codiceColoreSanitario);
  if (!colore) {
    const hit = await findMissioneDocForPaziente(manifestationId, paziente);
    if (!hit || isMissionePmaInvioPs(hit.data)) return;
    await refreshMissioneCodiceColoreTrasporto(manifestationId, hit.id, hit.data, {
      forceFromPaziente: false,
    });
    return;
  }
  const hit = await findMissioneDocForPaziente(manifestationId, paziente);
  if (!hit || isMissionePmaInvioPs(hit.data)) return;
  await refreshMissioneCodiceColoreTrasporto(manifestationId, hit.id, hit.data, {
    forceFromPaziente: false,
  });
}

/**
 * Persiste codice colore paziente, allinea PMA se presente, aggiorna T missione collegata.
 * @returns {{ pmaResult?: { applied: boolean, conflict?: object, reason?: string } }}
 */
export async function syncPazienteCodiceColoreSanitario(
  manifestationId,
  paziente,
  codiceColore,
  { pmaColoreForceApply = false } = {},
) {
  if (!manifestationId || !paziente?._docId) return {};

  const impSnap = await getDoc(impostazioniDocRef(manifestationId));
  const coloriValidi = coloriEventoValidiSet(
    impSnap.exists() ? normalizeImpostazioni(impSnap.data()) : null,
  );
  const esplicito =
    codiceColore != null && codiceColore !== '' && coloriValidi.has(codiceColore);

  await patchPaziente(
    manifestationId,
    paziente._docId,
    esplicito
      ? { codiceColoreSanitario: codiceColore }
      : { codiceColoreSanitario: deleteField() },
  );

  let pmaResult = { applied: false };
  if (esplicito) {
    pmaResult = await syncPmaCodiceColoreFromSanitario(
      manifestationId,
      paziente._docId,
      paziente,
      codiceColore,
      { forceApply: pmaColoreForceApply },
    );
  }

  await syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, {
    ...paziente,
    codiceColoreSanitario: esplicito ? codiceColore : '',
  });

  return { pmaResult };
}

/** Allinea codice paziente (P), scheda PMA se presente, e T missione collegata. */
export async function patchMissioneCodiceColoreFromPaziente(manifestationId, paziente, codiceColore) {
  if (!manifestationId || !paziente) return;
  await syncPazienteCodiceColoreSanitario(manifestationId, paziente, codiceColore);
}

async function mezzoHaAltreMissioniBloccanti(manifestationId, mezzoSiglaRaw, excludeDocId) {
  const nk = normalizeMezzoKey(mezzoSiglaRaw);
  if (!nk) return false;
  const snap = await getDocs(collection(db, ...missioniPath(manifestationId)));
  return snap.docs.some((d) => {
    if (d.id === excludeDocId) return false;
    const m = d.data();
    if (m.aperta === false) return false;
    if (!m.mezzo || normalizeMezzoKey(m.mezzo) !== nk) return false;
    return missioneBloccaMezzo({ ...m, _docId: d.id });
  });
}

async function syncStatoMezzoDopoMissione(manifestationId, mezzoSiglaRaw, excludeDocId, fields) {
  if (!mezzoSiglaRaw) return;
  if (await mezzoHaAltreMissioniBloccanti(manifestationId, mezzoSiglaRaw, excludeDocId)) {
    return;
  }
  const mezzoDoc = await resolveMezzoDocIdFirestore(manifestationId, mezzoSiglaRaw);
  if (!mezzoDoc) return;
  if (fields.stato === 'ANNULLATA' && fields.missioneEccezioneMotivo === MISSIONE_ECCEZIONE_MOTIVO.AVARIA_SINISTRO) {
    await patchMezzo(manifestationId, mezzoDoc, {
      statoMezzo: MEZZO_STATO_AVARIA_SINISTRO,
      operativo: false,
    });
    return;
  }
  await patchMezzo(manifestationId, mezzoDoc, { statoMezzo: 'Disponibile' });
}

export async function patchMissione(manifestationId, docId, fields, mezzoSigla) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...missioniPath(manifestationId), docId);
  const payload = omitUndefinedFields(stripOperatoreCreatoFromPatch({ ...fields }));
  if (fields.stato != null) {
    payload.statoDa = serverTimestamp();
  }
  if (Object.keys(payload).length === 0) return;

  const hasTratteMerge = Object.prototype.hasOwnProperty.call(payload, 'tratteMissione');
  if (hasTratteMerge) {
    const clientTratte = payload.tratteMissione;
    delete payload.tratteMissione;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) return;
      const merged = mergeTratteMissioneWrite(snap.data().tratteMissione, clientTratte);
      transaction.update(
        docRef,
        omitUndefinedFields({ ...payload, tratteMissione: merged }),
      );
    });
  } else {
    await updateDoc(docRef, payload);
  }
  if (fields.stato === 'ARRIVATO H') {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await syncPazientiArrivatoH(manifestationId, { _docId: snap.id, ...snap.data() });
    }
  }
  if (
    (fields.stato === 'RIENTRO' ||
      fields.stato === 'FINE MISSIONE' ||
      fields.stato === 'ANNULLATA') &&
    mezzoSigla
  ) {
    await syncStatoMezzoDopoMissione(manifestationId, mezzoSigla, docId, fields);
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
