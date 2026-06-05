import { deleteField, Timestamp } from 'firebase/firestore';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import {
  EVENTO_ORIGINE_ECCEZIONE,
  MISSIONE_ECCEZIONE_MOTIVO,
} from '../lib/missionEccezioni';
import { parseCodiceColoreOptional } from '../lib/codiciColore';
import { ESITO_MISSIONE_DEFAULT } from '../lib/missioneEsito';
import { mergeOperatoreCreatoPayload } from '../lib/operatoreAudit';
import { scheduleNotifyTelegramStatoFromCentrale } from '../lib/telegramSideEffects';
import { createEvento } from './eventiService';
import { createMissione, deleteMissione, patchMissione } from './missioniService';

const PATCH_NO_TELEGRAM = { skipTelegramNotify: true };

function optionalColoreMissionePayload(coloreRaw) {
  const m = parseCodiceColoreOptional(coloreRaw);
  return m ? { codiceColoreMissione: m } : {};
}

function buildAnnullaMissioneFields(missione, motivo, note) {
  return {
    ...buildStatoChangeFields(missione, 'ANNULLATA'),
    aperta: false,
    missioneEccezioneMotivo: motivo,
    missioneEccezioneNote: (note ?? '').trim(),
    missioneEccezioneIl: Timestamp.now(),
  };
}

function snapshotMissionePrimaAnnulla(missione) {
  return {
    aperta: missione.aperta !== false,
    stato: missione.stato ?? 'ALLERTARE',
    esitoMissione: missione.esitoMissione ?? ESITO_MISSIONE_DEFAULT,
    missioneEccezioneMotivo: missione.missioneEccezioneMotivo ?? null,
    missioneEccezioneNote: missione.missioneEccezioneNote ?? null,
    missioneEccezioneIl: missione.missioneEccezioneIl ?? null,
  };
}

function buildRevertAnnullamentoFields(snapshot) {
  return {
    ...buildStatoChangeFields({ storicoStati: {} }, snapshot.stato),
    aperta: snapshot.aperta,
    esitoMissione: snapshot.esitoMissione,
    missioneEccezioneMotivo: deleteField(),
    missioneEccezioneNote: deleteField(),
    missioneEccezioneIl: deleteField(),
  };
}

async function revertAnnullamentoMissione(manifestationId, missione, snapshot) {
  await patchMissione(
    manifestationId,
    missione._docId,
    buildRevertAnnullamentoFields(snapshot),
    missione.mezzo,
    PATCH_NO_TELEGRAM,
  );
}

function missioniDopoAnnulla(allMissioni, missioneDocId) {
  return (allMissioni ?? []).map((m) =>
    m?._docId === missioneDocId ? { ...m, aperta: false, stato: 'ANNULLATA' } : m,
  );
}

function notifyTelegramDopoEccezione(manifestationId, missioneAnnullataDocId, nuovaMissioneDocId) {
  scheduleNotifyTelegramStatoFromCentrale(manifestationId, missioneAnnullataDocId);
  if (nuovaMissioneDocId) {
    scheduleNotifyTelegramStatoFromCentrale(manifestationId, nuovaMissioneDocId);
  }
}

/**
 * Dirottamento: stesso mezzo su nuova missione sull’evento B, poi annulla missione sull’evento A.
 * Ordine: prima il legame su B (con ignoreOpenMissionDocId), poi annullamento su A — così un
 * fallimento in creazione non lascia mai il mezzo scollegato da entrambi gli eventi.
 * Telegram e notifiche equipaggio sono secondari: non bloccano mai l’operazione.
 */
export async function eseguiDirottamentoMissione({
  manifestationId,
  missione,
  eventoDestinazione,
  allMissioni,
  mezzoRecord,
  note,
  creatoDaUid,
  creatoDaNomeUtente,
  creatoDaNome,
}) {
  if (!missione?._docId) {
    throw new Error('Missione di origine non valida.');
  }
  if (!missione.mezzo) {
    throw new Error('Missione senza mezzo assegnato.');
  }
  if (!eventoDestinazione?.idUnivoco && !eventoDestinazione?.idEvento) {
    throw new Error('Evento di destinazione senza identificativo valido (idUnivoco / idEvento).');
  }

  const audit = mergeOperatoreCreatoPayload({
    creatoDaUid,
    creatoDaNomeUtente,
    creatoDaNome,
  });
  const fields = buildAnnullaMissioneFields(
    missione,
    MISSIONE_ECCEZIONE_MOTIVO.DIROTTAMENTO,
    note,
  );

  const created = await createMissione(
    manifestationId,
    {
      eventoIdUnivoco: eventoDestinazione.idUnivoco,
      eventoCorrelato: eventoDestinazione.idEvento,
      mezzo: missione.mezzo,
      pazienteAutopresentato: false,
      statoInizialeForzato: 'ALLERTARE',
      ...optionalColoreMissionePayload(eventoDestinazione.colore),
      ...audit,
    },
    allMissioni,
    mezzoRecord,
    { ignoreOpenMissionDocId: missione._docId },
  );

  try {
    await patchMissione(
      manifestationId,
      missione._docId,
      fields,
      missione.mezzo,
      PATCH_NO_TELEGRAM,
    );
  } catch (annulErr) {
    try {
      await deleteMissione(manifestationId, created.docId, { skipTelegramNotify: true });
    } catch (deleteErr) {
      console.error('[dirottamento compensazione]', deleteErr);
      const base = annulErr instanceof Error ? annulErr.message : String(annulErr);
      throw new Error(
        `${base} Inoltre la rimozione della missione provvisoria sull’evento destinazione non è riuscita: controlla manualmente eventi e mezzo.`,
      );
    }
    throw annulErr;
  }

  notifyTelegramDopoEccezione(manifestationId, missione._docId, created.docId);
  return created;
}

/**
 * Flag-down: annulla missione verso evento padre, crea evento figlio + missione IN POSTO sul nuovo intervento.
 */
export async function eseguiFlagDownMissione({
  manifestationId,
  missione,
  eventoPadre,
  nuovoEventoFields,
  existingEventi,
  allMissioni,
  mezzoRecord,
  noteAnnullamento,
  creatoDaUid,
  creatoDaNomeUtente,
  creatoDaNome,
}) {
  const audit = mergeOperatoreCreatoPayload({
    creatoDaUid,
    creatoDaNomeUtente,
    creatoDaNome,
  });
  const rollback = snapshotMissionePrimaAnnulla(missione);
  const allMissioniNext = missioniDopoAnnulla(allMissioni, missione._docId);
  const fields = buildAnnullaMissioneFields(
    missione,
    MISSIONE_ECCEZIONE_MOTIVO.FLAG_DOWN,
    noteAnnullamento,
  );

  let annullata = false;
  try {
    await patchMissione(
      manifestationId,
      missione._docId,
      fields,
      missione.mezzo,
      PATCH_NO_TELEGRAM,
    );
    annullata = true;

    const childPayload = {
      ...nuovoEventoFields,
      eventoGenitoreIdUnivoco: eventoPadre.idUnivoco,
      eventoGenitoreCorrelato: eventoPadre.idEvento,
      origineEccezione: EVENTO_ORIGINE_ECCEZIONE.FLAG_DOWN,
      ...audit,
    };
    const { idEvento, idUnivoco } = await createEvento(
      manifestationId,
      childPayload,
      existingEventi,
    );

    const created = await createMissione(
      manifestationId,
      {
        eventoIdUnivoco: idUnivoco,
        eventoCorrelato: idEvento,
        mezzo: missione.mezzo,
        pazienteAutopresentato: false,
        statoInizialeForzato: 'IN POSTO',
        ...optionalColoreMissionePayload(nuovoEventoFields.colore),
        ...audit,
      },
      allMissioniNext,
      mezzoRecord,
      { ignoreOpenMissionDocId: missione._docId },
    );

    notifyTelegramDopoEccezione(manifestationId, missione._docId, created.docId);
    return created;
  } catch (err) {
    if (annullata) {
      try {
        await revertAnnullamentoMissione(manifestationId, missione, rollback);
      } catch (revertErr) {
        console.error('[flag-down rollback]', revertErr);
        const base = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${base} Inoltre il ripristino della missione precedente non è riuscito: controlla manualmente evento e mezzo.`,
        );
      }
    }
    throw err;
  }
}

/**
 * Avaria/sinistro in avvicinamento: annulla missione; mezzo → non operativo (gestito in patchMissione).
 */
export async function eseguiAvariaSinistroMissione({ manifestationId, missione, note }) {
  const fields = buildAnnullaMissioneFields(
    missione,
    MISSIONE_ECCEZIONE_MOTIVO.AVARIA_SINISTRO,
    note,
  );
  await patchMissione(manifestationId, missione._docId, fields, missione.mezzo);
}
