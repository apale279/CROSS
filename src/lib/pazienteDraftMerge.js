import { STATO_PAZIENTE_PMA } from '../constants';
import { isPazienteOriginePma } from './pmaModule';
import { toDatetimeLocalValue } from './datetimeLocal';
import { soreuFieldsFromPatient } from './soreuTrasporto';

const DRAFT_KEYS_DIRTY_MERGE = new Set([
  'aperta',
  'creatoLocal',
  'esito',
  'esitoAltro',
  'ospedaleDestinazione',
  'destinazionePmaId',
  'mezzo',
  'nome',
  'cognome',
  'eta',
  'sesso',
  'notePaziente',
  'pettorale',
  'telefono',
  'comune',
  'indirizzo',
  'dataNascita',
  'soreuOraMissione',
  'soreuNumeroMissione',
  'soreuAccompagnato',
  'soreuCodice',
  'codiceColoreSanitario',
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
    destinazionePmaId: p.destinazionePmaId ?? '',
    stato: isPazienteOriginePma(p) ? (p.stato ?? STATO_PAZIENTE_PMA) : (p.stato ?? 'ATTESA'),
    mezzo: p.mezzo ?? '',
    nome: p.nome ?? '',
    cognome: p.cognome ?? '',
    eta: p.eta != null ? String(p.eta) : '',
    sesso: p.sesso ?? '',
    notePaziente: p.notePaziente ?? '',
    pettorale: p.pettorale != null ? String(p.pettorale) : '',
    telefono: p.telefono ?? '',
    comune: p.comune ?? '',
    indirizzo: p.indirizzo ?? '',
    dataNascita: p.dataNascita ?? '',
    ...soreuFieldsFromPatient(p),
    codiceColoreSanitario: p.codiceColoreSanitario ?? '',
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
