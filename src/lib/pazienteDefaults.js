import { normalizeStatoPzPma, TIPO_PZ, normalizeTipoPz } from './pmaModule';

/** Valori sicuri per creazione / patch paziente (evita campi mancanti che bloccano l’app). */
export function defaultsForPatientCreate(payload = {}) {
  return {
    tipoPz: normalizeTipoPz(payload.tipoPz) || TIPO_PZ.CENTRALE,
    stato: payload.stato ?? 'ATTESA',
    esito: payload.esito ?? '',
    esitoAltro: payload.esitoAltro ?? '',
    mezzo: payload.mezzo ?? '',
    ospedaleDestinazione: payload.ospedaleDestinazione ?? '',
    destinazionePmaId: payload.destinazionePmaId ?? '',
    pmaId: payload.pmaId ?? payload.destinazionePmaId ?? '',
    statoPzPma: payload.statoPzPma ?? null,
    idMissione: payload.idMissione ?? '',
    missioneIdUnivoco: payload.missioneIdUnivoco ?? '',
    nome: payload.nome ?? '',
    cognome: payload.cognome ?? '',
    telefono: payload.telefono ?? '',
    dataNascita: payload.dataNascita ?? '',
    sesso: payload.sesso ?? '',
    notePaziente: payload.notePaziente ?? '',
    pettorale:
      payload.pettorale != null && payload.pettorale !== '' ? Number(payload.pettorale) : null,
    eta: payload.eta ?? null,
    soreuNumeroMissione: payload.soreuNumeroMissione ?? '',
    soreuAccompagnato: payload.soreuAccompagnato ?? ['NO'],
    soreuCodice: payload.soreuCodice ?? '',
    soreuOraMissione: payload.soreuOraMissione ?? null,
    arrivatoHAt: payload.arrivatoHAt ?? null,
    aperta: payload.aperta !== false,
  };
}

/** Normalizza documento letto da Firestore (migrazione soft campi obbligatori). */
export function normalizePatientDoc(doc) {
  if (!doc) return doc;
  const tipo = normalizeTipoPz(doc.tipoPz) || TIPO_PZ.CENTRALE;
  const statoPzPma = doc.statoPzPma != null ? normalizeStatoPzPma(doc.statoPzPma) : doc.statoPzPma;
  return {
    ...doc,
    tipoPz: tipo,
    stato: doc.stato ?? 'ATTESA',
    esito: doc.esito ?? '',
    esitoAltro: doc.esitoAltro ?? '',
    mezzo: doc.mezzo ?? '',
    ospedaleDestinazione: doc.ospedaleDestinazione ?? '',
    destinazionePmaId: doc.destinazionePmaId ?? doc.pmaId ?? '',
    pmaId: doc.pmaId ?? doc.destinazionePmaId ?? '',
    nome: doc.nome ?? '',
    cognome: doc.cognome ?? '',
    telefono: doc.telefono ?? '',
    dataNascita: doc.dataNascita ?? '',
    sesso: doc.sesso ?? '',
    notePaziente: doc.notePaziente ?? '',
    idMissione: doc.idMissione ?? '',
    missioneIdUnivoco: doc.missioneIdUnivoco ?? '',
    eventoIdUnivoco: doc.eventoIdUnivoco ?? '',
    eventoCorrelato: doc.eventoCorrelato ?? '',
    statoPzPma: statoPzPma ?? null,
    aperta: doc.aperta !== false,
  };
}
