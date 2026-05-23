import { Timestamp } from 'firebase/firestore';

/** Valori iniziali `pmaScheda` su documento paziente CROSS. */
export const EMPTY_PMA_SCHEDA = {
  breve_descrizione: '',
  codice_colore: 'verde',
  apr: '',
  allergie: '',
  allergie_verifica: null,
  app: '',
  EO_GENERALE: [],
  EO_NEUROLOGICO: [],
  EO_CUTE: [],
  EO_TORACE: [],
  EO_ADDOME: [],
  EO_CAPO_COLLO: [],
  eo_note: '',
  parametri_vitali: [],
  prestazioni_sel: [],
  ecg_cloudinary_url: null,
  farmaci: [],
  rivalutazioni: [],
  lesioni: [],
  tipo_evento: '',
  dettaglio_evento: '',
  dimissione_esito: null,
  dimissione_note: '',
  affidatario_nome: '',
  affidatario_cognome: '',
  affidatario_legame: '',
  firma_paziente_base64: null,
  dimissione_firma_medico_base64: null,
  dimesso_at: null,
  invio_ps_missione_areu: null,
  invio_ps_data_ora: null,
  invio_ps_mezzo: '',
  invio_ps_ospedale: '',
  invio_ps_codice_trasporto: null,
  invio_ps_note: '',
  infermiere_rif: '',
  medico_rif: '',
};

export function normalizePmaScheda(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PMA_SCHEDA };
  return { ...EMPTY_PMA_SCHEDA, ...raw };
}

export function ensurePmaSchedaOnInCarico(patch) {
  if (!patch || patch.statoPzPma !== 'in carico') return patch;
  if (patch.pmaScheda) return patch;
  return { ...patch, pmaScheda: { ...EMPTY_PMA_SCHEDA } };
}
