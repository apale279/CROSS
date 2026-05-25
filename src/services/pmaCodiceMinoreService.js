import { Timestamp } from 'firebase/firestore';
import { STATO_PAZIENTE_PMA } from '../constants';
import { STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import { createPaziente, deletePazienteCascade, patchPaziente } from './pazientiService';

function normalizeCodiceMinorePayload(payload = {}) {
  const pettoraleRaw = payload.pettorale ?? payload.numeroPettorale;
  const pettorale =
    pettoraleRaw != null && pettoraleRaw !== '' ? Number(pettoraleRaw) : null;
  const oraArrivo = payload.oraArrivo instanceof Timestamp ? payload.oraArrivo : Timestamp.now();
  const oraFine =
    payload.oraFine instanceof Timestamp
      ? payload.oraFine
      : payload.oraFine
        ? Timestamp.fromDate(new Date(payload.oraFine))
        : null;

  return {
    pettorale: Number.isFinite(pettorale) ? pettorale : null,
    codiceMinore: {
      motivoArrivo: String(payload.motivoArrivo ?? '').trim(),
      trattamento: String(payload.trattamento ?? '').trim(),
      oraArrivo,
      oraFine,
    },
  };
}

/** Crea paziente «codice minore» al PMA (solo campi astanteria). */
export async function createPazienteCodiceMinore(
  manifestationId,
  pmaId,
  pmaNome,
  payload,
  existingPazienti,
) {
  const { pettorale, codiceMinore } = normalizeCodiceMinorePayload(payload);
  if (pettorale == null) throw new Error('Numero pettorale obbligatorio');

  const chiuso = codiceMinore.oraFine != null;

  return createPaziente(
    manifestationId,
    {
      eventoIdUnivoco: '',
      eventoCorrelato: '',
      esito: '',
      esitoAltro: '',
      mezzo: '',
      nome: `Pett. ${pettorale}`,
      cognome: '',
      pettorale,
      ospedaleDestinazione: pmaNome ?? '',
      destinazionePmaId: pmaId,
      pmaId,
      tipoPz: TIPO_PZ.CODICE_MINORE,
      statoPzPma: chiuso ? STATO_PZ_PMA.DIMESSO : STATO_PZ_PMA.IN_CARICO,
      stato: STATO_PAZIENTE_PMA,
      aperta: !chiuso,
      codiceMinore,
    },
    existingPazienti,
  );
}

/** Aggiorna paziente «codice minore». */
export async function updatePazienteCodiceMinore(manifestationId, docId, payload) {
  const { pettorale, codiceMinore } = normalizeCodiceMinorePayload(payload);
  if (pettorale == null) throw new Error('Numero pettorale obbligatorio');

  const chiuso = codiceMinore.oraFine != null;

  await patchPaziente(manifestationId, docId, {
    pettorale,
    nome: `Pett. ${pettorale}`,
    codiceMinore,
    statoPzPma: chiuso ? STATO_PZ_PMA.DIMESSO : STATO_PZ_PMA.IN_CARICO,
    aperta: !chiuso,
  });
}

export async function deletePazienteCodiceMinore(manifestationId, docId) {
  await deletePazienteCascade(manifestationId, docId);
}

export function codiceMinoreFromPaziente(paziente) {
  const cm = paziente?.codiceMinore ?? {};
  return {
    pettorale: paziente?.pettorale ?? null,
    motivoArrivo: cm.motivoArrivo ?? '',
    trattamento: cm.trattamento ?? '',
    oraArrivo: cm.oraArrivo ?? paziente?.apertura ?? null,
    oraFine: cm.oraFine ?? null,
  };
}
