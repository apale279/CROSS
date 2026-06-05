import {
  addDoc,
  collection,
  deleteDoc,
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
import { mezziPath, missioniPath, pazientiPath } from '../lib/firestorePaths';
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
import { parseCodiceColoreOptional } from '../lib/codiciColore';
import { mergeOperatoreCreatoPayload, stripOperatoreCreatoFromPatch } from '../lib/operatoreAudit';
import { impostazioniDocRef } from './impostazioniService';
import {
  ESITO_MISSIONE_DEFAULT,
  esitoMissioneTerminaCopertura,
  normalizeEsitoMissione,
} from '../lib/missioneEsito';
import { pazienteInviatoVersoPma } from '../lib/missionPmaPatientClose';
import { pazienteSuMissione } from '../lib/pazientiTrasportoQuery';
import { pazienteSameEventoAsMissione } from '../lib/eventoMissioneMatch';
import { MISSIONE_ECCEZIONE_MOTIVO, MEZZO_STATO_AVARIA_SINISTRO } from '../lib/missionEccezioni';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { mergeTratteMissioneWrite } from '../lib/missionTratte';
import { patchPaziente } from './pazientiService';
import { syncPazientiArrivatoH } from './pazientiService';
import {
  isMissionePmaInvioPs,
} from '../lib/pmaInvioPsMission';
import { syncPazientiPmaOnDirettoH, syncPmaCodiceColoreFromSanitario } from './pazientePmaMissionSync';
import {
  fetchEventoForMissione,
  timestampToDate,
  validateMissioneAperturaChange,
} from '../lib/missioneAperturaValidate';
import {
  scheduleNotifyTelegramMissioneEliminata,
  scheduleNotifyTelegramStatoFromCentrale,
} from '../lib/telegramSideEffects';
import { awaitNotifyTelegramMissioneEliminataFromCentrale } from './telegramService';
import { statiPercorsiAvanzamento } from '../utils/missionStati';

const STATI_MEZZO_LIBERATO = new Set(['ARRIVATO H', 'RIENTRO', 'FINE MISSIONE', 'ANNULLATA']);

async function resolveStatiMissioneOrdinati(manifestationId) {
  const impSnap = await getDoc(impostazioniDocRef(manifestationId));
  const imp = normalizeImpostazioni(impSnap.exists() ? impSnap.data() : {});
  return resolveStatiMissione(imp);
}

async function applyMissioneStatoSideEffects(
  manifestationId,
  missioneRow,
  stato,
  mezzoSigla,
  fieldsForMezzo,
) {
  if (stato === 'DIRETTO H') {
    await syncPazientiPmaOnDirettoH(manifestationId, missioneRow);
  }
  if (stato === 'ARRIVATO H') {
    await syncPazientiArrivatoH(manifestationId, missioneRow);
  }
  if (STATI_MEZZO_LIBERATO.has(stato) && mezzoSigla) {
    await syncStatoMezzoDopoMissione(manifestationId, mezzoSigla, missioneRow._docId, {
      ...fieldsForMezzo,
      stato,
    });
  }
}

function assertMezzoLiberoPerNuovaMissione(
  mezzoSigla,
  existingMissioni,
  { chiudiMissioniRientro, ignoreOpenMissionDocId } = {},
) {
  if (!mezzoSigla) return;
  const ignoreId = String(ignoreOpenMissionDocId ?? '').trim();
  const lista = (existingMissioni ?? []).filter((m) => !ignoreId || m?._docId !== ignoreId);
  const aperte = missioniAperteSuMezzo(lista, mezzoSigla);
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
      { skipTelegramNotify: true },
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

export async function createMissione(
  manifestationId,
  payload,
  existingMissioni,
  mezzo,
  options = {},
) {
  const mezzoSiglaEarly = payload.mezzo
    ? await resolveMezzoDocIdFirestore(manifestationId, payload.mezzo)
    : '';
  let missionPayload = payload;
  if (mezzoSiglaEarly) {
    const ignoreId = options.ignoreOpenMissionDocId;
    const lista = (existingMissioni ?? []).filter(
      (m) => !ignoreId || m?._docId !== ignoreId,
    );
    const aperte = missioniAperteSuMezzo(lista, mezzoSiglaEarly);
    const rientro = aperte.filter((m) => isStatoMissioneRientroOLiberato(m.stato));
    if (rientro.length > 0 && !payload.chiudiMissioniRientro) {
      missionPayload = { ...payload, chiudiMissioniRientro: true };
    }
    assertMezzoLiberoPerNuovaMissione(mezzoSiglaEarly, existingMissioni, {
      chiudiMissioniRientro: !!missionPayload.chiudiMissioniRientro,
      ignoreOpenMissionDocId: ignoreId,
    });
    await terminaMissioniRientroPrecedenti(manifestationId, mezzoSiglaEarly, lista);
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
  if (!statiAmmessi.includes(statoIniziale)) {
    throw new Error(
      autopresentato
        ? `Stato «IN POSTO» non configurato negli stati missione (Impostazioni). ` +
            'Aggiungi «IN POSTO» alla lista oppure crea la missione senza flag autopresentato.'
        : `Stato missione iniziale «${statoIniziale}» non presente in Impostazioni.`,
    );
  }
  const eventoIdUnivoco = String(payload.eventoIdUnivoco ?? '').trim();
  const eventoCorrelato = String(payload.eventoCorrelato ?? '').trim();
  if (!eventoIdUnivoco || !eventoCorrelato) {
    throw new Error(
      'Collegamento evento mancante. Chiudi la scheda evento, riaprila dall\'elenco eventi e riprova a creare la missione.',
    );
  }

  const coloreMissione = parseCodiceColoreOptional(payload.codiceColoreMissione);
  const ospedaleDest = String(payload.ospedaleDestinazione ?? '').trim();
  const mezzoSigla = mezzoSiglaEarly;
  const equipaggio = await equipaggioTestoAlLegameMezzo(manifestationId, mezzoSigla, mezzo);
  const colRef = collection(db, ...missioniPath(manifestationId));
  const docRef = await addDoc(colRef, {
    manifestationId,
    idUnivoco,
    idMissione,
    eventoIdUnivoco,
    eventoCorrelato,
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
  const idMis = String(paziente.idMissione ?? '').trim();
  if (idMis) {
    const q = query(colRef, where('idMissione', '==', idMis), limit(24));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const open = docs.filter((x) => x.data.aperta !== false);
    const nk = paziente.mezzo ? normalizeMezzoKey(paziente.mezzo) : '';
    if (nk) {
      const byMezzo = open.find(
        (x) => x.data.mezzo && normalizeMezzoKey(x.data.mezzo) === nk,
      );
      if (byMezzo) return byMezzo;
    }
    const byEvento = open.find((x) => pazienteSameEventoAsMissione(paziente, x.data));
    if (byEvento) return byEvento;
    if (docs.length === 1) return docs[0];
  }
  return null;
}

/**
 * Copia il codice colore del paziente su T della missione collegata.
 * Logica semplice: se il paziente ha colore+mezzo, scrivi T sulla missione.
 * T può essere poi modificato liberamente dall'operatore senza che venga
 * sovrascritto di nuovo (nessuna logica reattiva).
 */
export async function syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, paziente) {
  if (!manifestationId || !paziente) return;
  const colore = parseCodiceColoreOptional(paziente.codiceColoreSanitario);
  if (!colore) return; // nessun colore → non toccare T
  const hit = await findMissioneDocForPaziente(manifestationId, paziente);
  if (!hit || isMissionePmaInvioPs(hit.data)) return;
  await updateDoc(doc(db, ...missioniPath(manifestationId), hit.id), {
    codiceColoreTrasporto: colore,
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

/**
 * @param {object} [options]
 * @param {boolean} [options.skipTelegramNotify] — true in flussi multi-step (es. dirottamento)
 * @param {boolean} [options.skipAutoCloseEvento]
 */
export async function patchMissione(manifestationId, docId, fields, mezzoSigla, options = {}) {
  if (!fields || Object.keys(fields).length === 0) return;
  const docIdTrim = String(docId ?? '').trim();
  if (!docIdTrim) {
    throw new Error('Missione non valida. Chiudi la scheda e riaprila dall\'elenco missioni.');
  }
  const docRef = doc(db, ...missioniPath(manifestationId), docIdTrim);
  const payload = omitUndefinedFields(stripOperatoreCreatoFromPatch({ ...fields }));

  if (Object.prototype.hasOwnProperty.call(payload, 'apertura')) {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(
        'Missione non trovata. Potrebbe essere stata eliminata: chiudi la scheda e verifica nell\'elenco missioni.',
      );
    }
    const current = snap.data();
    const nextDate = timestampToDate(payload.apertura);
    const evento = await fetchEventoForMissione(manifestationId, current);
    const validation = validateMissioneAperturaChange({ nextDate, missione: current, evento });
    if (!validation.ok) throw new Error(validation.message);
  }

  if (fields.stato != null) {
    payload.statoDa = serverTimestamp();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'esitoMissione')) {
    payload.esitoMissione = normalizeEsitoMissione(payload.esitoMissione);
    if (esitoMissioneTerminaCopertura(payload.esitoMissione)) {
      payload.aperta = false;
    }
  }
  if (Object.keys(payload).length === 0) return;

  let statiPercorso = null;
  if (fields.stato != null) {
    const preSnap = await getDoc(docRef);
    if (!preSnap.exists()) {
      throw new Error(
        'Missione non trovata. Potrebbe essere stata eliminata: chiudi la scheda e verifica nell\'elenco missioni.',
      );
    }
    const precedenteStato = preSnap.data().stato ?? 'ALLERTARE';
    if (fields.stato === precedenteStato) return;
    const statiOrdinati = await resolveStatiMissioneOrdinati(manifestationId);
    statiPercorso = statiPercorsiAvanzamento(precedenteStato, fields.stato, statiOrdinati);
  }

  const hasTratteMerge = Object.prototype.hasOwnProperty.call(payload, 'tratteMissione');
  if (hasTratteMerge) {
    const clientTratte = payload.tratteMissione;
    delete payload.tratteMissione;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error(
          'Missione non trovata. Potrebbe essere stata eliminata: chiudi la scheda e verifica nell\'elenco missioni.',
        );
      }
      const merged = mergeTratteMissioneWrite(
        snap.data().tratteMissione,
        clientTratte,
        options.tratteRemoveIds,
      );
      transaction.update(
        docRef,
        omitUndefinedFields({ ...payload, tratteMissione: merged }),
      );
    });
  } else {
    await updateDoc(docRef, payload);
  }

  if (fields.stato != null && statiPercorso?.length) {
    const misSnap = await getDoc(docRef);
    if (misSnap.exists()) {
      const missioneRow = { _docId: misSnap.id, ...misSnap.data() };
      const fieldsForMezzo = { missioneEccezioneMotivo: fields.missioneEccezioneMotivo };
      for (const s of statiPercorso) {
        try {
          await applyMissioneStatoSideEffects(
            manifestationId,
            missioneRow,
            s,
            mezzoSigla,
            fieldsForMezzo,
          );
        } catch (err) {
          console.warn('[patchMissione stato side effect]', s, err);
        }
      }
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(fields, 'esitoMissione') &&
    esitoMissioneTerminaCopertura(fields.esitoMissione) &&
    mezzoSigla
  ) {
    await syncStatoMezzoDopoMissione(manifestationId, mezzoSigla, docId, { aperta: false });
  }
  if (
    !options.skipAutoCloseEvento &&
    (fields.stato != null ||
      fields.aperta != null ||
      Object.prototype.hasOwnProperty.call(fields, 'esitoMissione'))
  ) {
    try {
      await tryAutoCloseEventoForMissione(manifestationId, docId);
    } catch (err) {
      console.warn('[auto-close evento]', err);
    }
  }
  if (fields.stato != null && !options.skipTelegramNotify) {
    scheduleNotifyTelegramStatoFromCentrale(manifestationId, docId);
  }
}

/** Scollega i pazienti dalla missione eliminata (restano sull'evento). */
function fieldsScollegaPazienteDaMissione(paziente) {
  const patch = {
    mezzo: '',
    idMissione: '',
    missioneIdUnivoco: '',
  };
  if (paziente.stato === 'TRASPORTO') {
    patch.stato = 'ATTESA';
  }
  return patch;
}

export async function deleteMissione(manifestationId, docId, options = {}) {
  const docRef = doc(db, ...missioniPath(manifestationId), docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const missione = { _docId: docId, ...snap.data() };
  const mezzoSigla = missione.mezzo;

  const pazSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  const linked = pazSnap.docs.filter((d) =>
    pazienteSuMissione({ _docId: d.id, ...d.data() }, missione),
  );
  for (const d of linked) {
    const row = { ...d.data(), _docId: d.id };
    if (pazienteInviatoVersoPma(row)) continue;
    await patchPaziente(manifestationId, d.id, fieldsScollegaPazienteDaMissione(row));
  }

  if (!options.skipTelegramNotify) {
    try {
      await awaitNotifyTelegramMissioneEliminataFromCentrale(manifestationId, docId);
    } catch (err) {
      console.warn('[deleteMissione telegram]', err);
    }
  }
  await deleteDoc(docRef);

  if (mezzoSigla) {
    await syncStatoMezzoDopoMissione(manifestationId, mezzoSigla, docId, { aperta: false });
  }
}
