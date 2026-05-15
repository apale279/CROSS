import { toDatetimeLocalValue } from './datetimeLocal';

const DRAFT_KEYS_DIRTY_MERGE = new Set([
  'aperta',
  'creatoLocal',
  'esito',
  'esitoAltro',
  'ospedaleDestinazione',
  'mezzo',
  'nome',
  'cognome',
  'eta',
  'sesso',
  'notePaziente',
  'pettorale',
  'telefono',
  'dataNascita',
]);

/**
 * Da snapshot documento paziente (senza array valutazioni) alla forma draft bozza.
 */
export function patientDocToDraftFields(p) {
  return {
    aperta: p.aperta !== false,
    creatoLocal: toDatetimeLocalValue(p.apertura),
    esito: p.esito ?? '',
    esitoAltro: p.esitoAltro ?? '',
    ospedaleDestinazione: p.ospedaleDestinazione ?? '',
    stato: p.stato ?? 'ATTESA',
    mezzo: p.mezzo ?? '',
    nome: p.nome ?? '',
    cognome: p.cognome ?? '',
    eta: p.eta != null ? String(p.eta) : '',
    sesso: p.sesso ?? '',
    notePaziente: p.notePaziente ?? '',
    pettorale: p.pettorale != null ? String(p.pettorale) : '',
    telefono: p.telefono ?? '',
    dataNascita: p.dataNascita ?? '',
  };
}

/**
 * Merge server → draft: i campi in `dirty` non vengono sovrascritti.
 * `stato` segue sempre il server (non è “digitato” come testo libero).
 */
export function mergePatientDraftFromServer(prevDraft, serverRow, dirty) {
  const srv = patientDocToDraftFields(serverRow);
  const out = { ...prevDraft };
  for (const k of DRAFT_KEYS_DIRTY_MERGE) {
    if (dirty.has(k)) continue;
    if (k in srv) out[k] = srv[k];
  }
  out.stato = srv.stato;
  return out;
}
