import { deleteField, Timestamp } from 'firebase/firestore';
import { STATO_PAZIENTE_PMA } from '../constants';
import {
  STATO_PZ_PMA,
  TIPO_PZ,
  isPazienteCodiceMinore,
  normalizeStatoPzPma,
  pazientePmaChiuso,
  pmaIdPerPaziente,
  STATI_PZ_PMA_APERTI,
} from '../lib/pmaModule';
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

function seedMotivoFromPaziente(paziente) {
  const scheda = paziente?.pmaScheda ?? {};
  const parts = [
    scheda.tipo_evento,
    scheda.dettaglio_evento,
    scheda.breve_descrizione,
    paziente?.notePaziente,
  ]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return parts.join(' — ');
}

/** Converte un paziente PMA/centrale in codice minore (fast track astanteria). */
export async function convertPazienteToCodiceMinore(
  manifestationId,
  docId,
  pmaId,
  existingRow,
) {
  if (!existingRow) throw new Error('Paziente non trovato');
  if (isPazienteCodiceMinore(existingRow)) throw new Error('Paziente già codice minore');
  if (pazientePmaChiuso(existingRow)) throw new Error('Paziente già chiuso');
  const stato = normalizeStatoPzPma(existingRow.statoPzPma);
  if (!stato || !STATI_PZ_PMA_APERTI.includes(stato)) {
    throw new Error('Il paziente non è attivo al PMA');
  }
  const pazientePma = pmaIdPerPaziente(existingRow);
  if (pazientePma && pazientePma !== pmaId) {
    throw new Error('Paziente di un altro PMA');
  }

  const existingCm = existingRow.codiceMinore ?? {};
  const codiceMinorePatch = {
    motivoArrivo:
      String(existingCm.motivoArrivo ?? '').trim() || seedMotivoFromPaziente(existingRow),
    trattamento: String(existingCm.trattamento ?? '').trim(),
    oraArrivo: existingCm.oraArrivo ?? Timestamp.now(),
    oraFine: existingCm.oraFine ?? null,
  };

  await patchPazienteCodiceMinoreScalars(
    manifestationId,
    docId,
    {
      tipoPz: TIPO_PZ.CODICE_MINORE,
      statoPzPma: STATO_PZ_PMA.IN_CARICO,
      stato: STATO_PAZIENTE_PMA,
      aperta: true,
      pmaId: pmaId || existingRow.pmaId || existingRow.destinazionePmaId || '',
      destinazionePmaId:
        existingRow.destinazionePmaId || pmaId || existingRow.pmaId || '',
    },
    codiceMinorePatch,
  );
}

/** Aggiorna motivo e prestazione (fast track). */
export async function patchCodiceMinoreFastTrack(manifestationId, docId, { motivoArrivo, trattamento }) {
  const patch = {};
  if (motivoArrivo !== undefined) patch.motivoArrivo = String(motivoArrivo ?? '').trim();
  if (trattamento !== undefined) patch.trattamento = String(trattamento ?? '').trim();
  if (Object.keys(patch).length === 0) return;
  await patchPazienteCodiceMinoreScalars(manifestationId, docId, {}, patch);
}

/** Chiude paziente codice minore (equivalente dimissione PMA). */
export async function chiudiPazienteCodiceMinore(manifestationId, docId) {
  await patchPazienteCodiceMinoreScalars(
    manifestationId,
    docId,
    {
      statoPzPma: STATO_PZ_PMA.DIMESSO,
      aperta: false,
      pmaPostoLettoId: deleteField(),
    },
    { oraFine: Timestamp.now() },
  );
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
