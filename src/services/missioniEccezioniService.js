import { Timestamp } from 'firebase/firestore';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import {
  EVENTO_ORIGINE_ECCEZIONE,
  MISSIONE_ECCEZIONE_MOTIVO,
} from '../lib/missionEccezioni';
import { createEvento } from './eventiService';
import { parseCodiceColoreOptional } from '../lib/codiciColore';
import { createMissione, patchMissione } from './missioniService';

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

/**
 * Dirottamento: annulla missione sull’evento A, stesso mezzo su nuova missione sull’evento B.
 */
export async function eseguiDirottamentoMissione({
  manifestationId,
  missione,
  eventoDestinazione,
  allMissioni,
  mezzoRecord,
  note,
}) {
  const allMissioniNext = (allMissioni ?? []).map((m) =>
    m?._docId === missione?._docId ? { ...m, aperta: false, stato: 'ANNULLATA' } : m,
  );
  const fields = buildAnnullaMissioneFields(
    missione,
    MISSIONE_ECCEZIONE_MOTIVO.DIROTTAMENTO,
    note,
  );
  await patchMissione(manifestationId, missione._docId, fields, missione.mezzo);
  await createMissione(
    manifestationId,
    {
      eventoIdUnivoco: eventoDestinazione.idUnivoco,
      eventoCorrelato: eventoDestinazione.idEvento,
      mezzo: missione.mezzo,
      pazienteAutopresentato: false,
      statoInizialeForzato: 'ALLERTATO',
      ...optionalColoreMissionePayload(eventoDestinazione.colore),
    },
    allMissioniNext,
    mezzoRecord,
  );
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
}) {
  const allMissioniNext = (allMissioni ?? []).map((m) =>
    m?._docId === missione?._docId ? { ...m, aperta: false, stato: 'ANNULLATA' } : m,
  );
  const fields = buildAnnullaMissioneFields(
    missione,
    MISSIONE_ECCEZIONE_MOTIVO.FLAG_DOWN,
    noteAnnullamento,
  );
  await patchMissione(manifestationId, missione._docId, fields, missione.mezzo);

  const childPayload = {
    ...nuovoEventoFields,
    eventoGenitoreIdUnivoco: eventoPadre.idUnivoco,
    eventoGenitoreCorrelato: eventoPadre.idEvento,
    origineEccezione: EVENTO_ORIGINE_ECCEZIONE.FLAG_DOWN,
  };
  const { idEvento, idUnivoco } = await createEvento(manifestationId, childPayload, existingEventi);

  await createMissione(
    manifestationId,
    {
      eventoIdUnivoco: idUnivoco,
      eventoCorrelato: idEvento,
      mezzo: missione.mezzo,
      pazienteAutopresentato: false,
      statoInizialeForzato: 'IN POSTO',
      ...optionalColoreMissionePayload(nuovoEventoFields.colore),
    },
    allMissioniNext,
    mezzoRecord,
  );
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
