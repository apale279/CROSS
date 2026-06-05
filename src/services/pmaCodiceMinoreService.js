import { Timestamp } from 'firebase/firestore';
import { STATO_PAZIENTE_PMA } from '../constants';
import { STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import { isPercorsoCodiceMinoreTrasporto } from '../lib/pmaDestinazioneTrasporto';
import { buildCodiceMinoreTrasportoNome } from '../lib/codiceMinoreTrasportoNome';
import { etaDaDataNascita } from '../lib/excelPartecipanti';
import { createPaziente, deletePazienteCascade } from './pazientiService';
import { deleteAllCodiceMinoreFoto } from './pmaCodiceMinoreFotoService';
import { patchPazienteCodiceMinoreScalars } from '../lib/patchPazienteCodiceMinore';

function normalizeCodiceMinorePayload(payload = {}, { requirePettorale = true } = {}) {
  const pettoraleRaw = payload.pettorale ?? payload.numeroPettorale;
  const pettorale =
    pettoraleRaw != null && pettoraleRaw !== '' ? Number(pettoraleRaw) : null;
  if (requirePettorale && pettorale == null) {
    throw new Error('Numero pettorale obbligatorio');
  }
  const oraArrivo = payload.oraArrivo instanceof Timestamp ? payload.oraArrivo : Timestamp.now();
  const oraFine =
    payload.oraFine instanceof Timestamp
      ? payload.oraFine
      : payload.oraFine
        ? Timestamp.fromDate(new Date(payload.oraFine))
        : null;

  const codiceMinore = {
    motivoArrivo: String(payload.motivoArrivo ?? '').trim(),
    trattamento: String(payload.trattamento ?? '').trim(),
    oraArrivo,
    oraFine,
  };
  if (Array.isArray(payload.foto)) {
    codiceMinore.foto = payload.foto;
  }

  return {
    pettorale: Number.isFinite(pettorale) ? pettorale : null,
    nome: String(payload.nome ?? '').trim(),
    cognome: String(payload.cognome ?? '').trim(),
    dataNascita: String(payload.dataNascita ?? '').trim(),
    eta: payload.eta != null && payload.eta !== '' ? Number(payload.eta) : null,
    codiceMinore,
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
  const { pettorale, nome, cognome, dataNascita, eta, codiceMinore } =
    normalizeCodiceMinorePayload(payload);
  if (pettorale == null) throw new Error('Numero pettorale obbligatorio');

  const chiuso = codiceMinore.oraFine != null;
  const nomeFinale = nome || `Pett. ${pettorale}`;
  const etaFinale =
    Number.isFinite(eta) ? eta : dataNascita ? etaDaDataNascita(dataNascita) : null;

  return createPaziente(
    manifestationId,
    {
      eventoIdUnivoco: '',
      eventoCorrelato: '',
      esito: '',
      esitoAltro: '',
      mezzo: '',
      nome: nomeFinale,
      cognome,
      pettorale,
      dataNascita,
      eta: etaFinale,
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
export async function updatePazienteCodiceMinore(manifestationId, docId, payload, existingRow) {
  const requirePettorale = !isPercorsoCodiceMinoreTrasporto(existingRow);
  const { pettorale, nome, cognome, dataNascita, eta, codiceMinore } =
    normalizeCodiceMinorePayload(payload, { requirePettorale });
  if (requirePettorale && pettorale == null) throw new Error('Numero pettorale obbligatorio');

  const chiuso = codiceMinore.oraFine != null;
  const nomeFinale =
    nome ||
    (pettorale != null ? `Pett. ${pettorale}` : buildCodiceMinoreTrasportoNome(existingRow));
  const etaFinale =
    Number.isFinite(eta) ? eta : dataNascita ? etaDaDataNascita(dataNascita) : null;
  const codiceMinorePatch = { ...codiceMinore };
  delete codiceMinorePatch.foto;

  await patchPazienteCodiceMinoreScalars(
    manifestationId,
    docId,
    {
      pettorale,
      nome: nomeFinale,
      cognome,
      dataNascita,
      eta: etaFinale,
      statoPzPma: chiuso ? STATO_PZ_PMA.DIMESSO : STATO_PZ_PMA.IN_CARICO,
      aperta: !chiuso,
    },
    codiceMinorePatch,
  );
}

export async function deletePazienteCodiceMinore(manifestationId, docId, existingRow) {
  if (existingRow) {
    await deleteAllCodiceMinoreFoto(manifestationId, docId, existingRow);
  }
  await deletePazienteCascade(manifestationId, docId);
}

export function codiceMinoreFromPaziente(paziente) {
  const cm = paziente?.codiceMinore ?? {};
  const foto = Array.isArray(cm.foto) ? cm.foto.filter((f) => f?.url) : [];
  return {
    pettorale: paziente?.pettorale ?? null,
    nome: paziente?.nome ?? '',
    cognome: paziente?.cognome ?? '',
    dataNascita: paziente?.dataNascita ?? '',
    eta: paziente?.eta ?? null,
    motivoArrivo: cm.motivoArrivo ?? '',
    provenienzaTrasporto: cm.provenienzaTrasporto ?? '',
    trattamento: cm.trattamento ?? '',
    oraArrivo: cm.oraArrivo ?? paziente?.apertura ?? null,
    oraFine: cm.oraFine ?? null,
    foto,
  };
}
