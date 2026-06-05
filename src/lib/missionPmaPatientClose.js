import { deleteField } from 'firebase/firestore';
import { STATO_PAZIENTE_PMA } from '../constants';
import { displayAnagraficaCodiceMinore } from './codiceMinoreTrasportoNome';
import { findEvento } from './eventoLinks';
import { isPercorsoCodiceMinoreTrasporto } from './pmaDestinazioneTrasporto';
import { findPmaById, normalizeStatoPzPma, STATO_PZ_PMA, TIPO_PZ } from './pmaModule';
import { pazienteSuMissione } from './pazientiTrasportoQuery';
import { emptySoreuFirestoreClear } from './soreuTrasporto';

export const MISSION_PMA_CLOSE_MOTIVO = {
  FINE_MISSIONE: 'FINE_MISSIONE',
  ANNULLATA: 'ANNULLATA',
  DELETE: 'DELETE',
  CHIUSURA_EVENTO: 'CHIUSURA_EVENTO',
  MEZZO_DISPONIBILE: 'MEZZO_DISPONIBILE',
  ESITO_COPERTURA: 'ESITO_COPERTURA',
};

const MOTIVO_LABEL = {
  [MISSION_PMA_CLOSE_MOTIVO.FINE_MISSIONE]: 'chiusura missione (FINE MISSIONE)',
  [MISSION_PMA_CLOSE_MOTIVO.ANNULLATA]: 'annullamento missione',
  [MISSION_PMA_CLOSE_MOTIVO.DELETE]: 'eliminazione missione',
  [MISSION_PMA_CLOSE_MOTIVO.CHIUSURA_EVENTO]: 'chiusura forzata evento',
  [MISSION_PMA_CLOSE_MOTIVO.MEZZO_DISPONIBILE]: 'mezzo impostato DISPONIBILE',
  [MISSION_PMA_CLOSE_MOTIVO.ESITO_COPERTURA]: 'esito missione che termina copertura',
};

/** Paziente con invio PMA ancora aperto (in arrivo / in attesa / in carico). */
export function pazienteInviatoVersoPma(paziente) {
  if (!String(paziente?.destinazionePmaId ?? '').trim()) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  return (
    stato === STATO_PZ_PMA.IN_ARRIVO ||
    stato === STATO_PZ_PMA.IN_ATTESA ||
    stato === STATO_PZ_PMA.IN_CARICO
  );
}

export function pazientiPmaSuMissione(pazienti, missione) {
  if (!missione) return [];
  return (pazienti ?? []).filter(
    (p) => pazienteInviatoVersoPma(p) && pazienteSuMissione(p, missione),
  );
}

/** Pazienti PMA unici su più missioni (dedupe per _docId). */
export function pazientiPmaSuMissioni(pazienti, missioni) {
  const seen = new Set();
  const out = [];
  for (const mis of missioni ?? []) {
    for (const p of pazientiPmaSuMissione(pazienti, mis)) {
      const id = p._docId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(p);
    }
  }
  return out;
}

export function buildProvenienzaTrasportoCentrale({
  paziente,
  missione,
  evento,
  motivoChiusura,
  quando = new Date(),
}) {
  const parts = [];
  const evId = evento?.idEvento ?? paziente?.eventoCorrelato;
  if (evId) parts.push(`Evento ${evId}`);
  const misId = missione?.idMissione ?? paziente?.idMissione;
  if (misId) parts.push(`Missione ${misId}`);
  const mezzo = missione?.mezzo ?? paziente?.mezzo;
  if (mezzo) parts.push(`Mezzo ${mezzo}`);
  const motivo = MOTIVO_LABEL[motivoChiusura] ?? String(motivoChiusura ?? '').trim();
  const quandoStr = quando.toLocaleString('it-IT');
  const core = parts.filter(Boolean).join(' — ');
  return `[Trasporto centrale scollegato] ${core || 'Centrale'} (${motivo}, ${quandoStr})`;
}

/** Scollega evento/missione/mezzo; mantiene PMA e traccia testuale. */
export function fieldsMantieniPazienteAlPma(paziente, provenienzaText) {
  const base = {
    eventoCorrelato: '',
    eventoIdUnivoco: '',
    mezzo: '',
    idMissione: '',
    missioneIdUnivoco: '',
    esito: '',
    esitoAltro: '',
    stato: STATO_PAZIENTE_PMA,
    aperta: true,
    arrivatoHAt: null,
    ...emptySoreuFirestoreClear(),
  };

  if (isPercorsoCodiceMinoreTrasporto(paziente)) {
    return {
      ...base,
      'codiceMinore.provenienzaTrasporto': provenienzaText,
    };
  }

  const prevNote = String(paziente?.notePaziente ?? '').trim();
  const notePaziente = prevNote ? `${prevNote}\n\n${provenienzaText}` : provenienzaText;
  return { ...base, notePaziente };
}

/** Annulla invio PMA: paziente resta sull'evento senza trasporto né tenda. */
export function fieldsAnnullaInvioPma() {
  return {
    mezzo: '',
    idMissione: '',
    missioneIdUnivoco: '',
    ospedaleDestinazione: '',
    destinazionePmaId: '',
    pmaId: '',
    statoPzPma: deleteField(),
    percorsoCodiceMinore: deleteField(),
    tipoPz: TIPO_PZ.CENTRALE,
    esito: '',
    esitoAltro: '',
    stato: 'ATTESA',
    aperta: true,
    arrivatoHAt: null,
    ...emptySoreuFirestoreClear(),
  };
}

export function labelPazientePmaRiga(paziente, impostazioni) {
  const nome = displayAnagraficaCodiceMinore(paziente);
  const pma = findPmaById(impostazioni, paziente.destinazionePmaId);
  const pmaNome = pma?.nome ?? paziente.destinazionePmaId ?? 'PMA';
  const tipo = isPercorsoCodiceMinoreTrasporto(paziente) ? 'codice minore' : 'tenda clinica';
  return `• ${nome} → ${pmaNome} (${tipo})`;
}

export function contestoEventoPerMissione(missione, eventi) {
  return findEvento(eventi, missione?.eventoIdUnivoco ?? missione?.eventoCorrelato) ?? null;
}
