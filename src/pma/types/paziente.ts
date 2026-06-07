import type { Timestamp } from 'firebase/firestore'
import type { DimissioneEsito } from './dimissione'
import type { LesioneMarker } from './lesioni'
import type {
  FarmacoSomministrato,
  ParametroVitaleRilevazione,
  RivalutazioneVoce,
} from './cartellaClinica'

/** Verifica obbligatoria prima di modificare la cartella (Firestore `allergie_verifica`). */
export type AllergieVerificaStato = 'si' | 'no' | 'non_noto'

export function isAllergieVerificaStato(v: unknown): v is AllergieVerificaStato {
  return v === 'si' || v === 'no' || v === 'non_noto'
}

export const ALLERGIE_VERIFICA_LABEL: Record<AllergieVerificaStato, string> = {
  si: 'SI',
  no: 'NO',
  non_noto: 'NON NOTO',
}

/** Testo per UI e PDF (manca valore → trattino). */
export function allergieVerificaDisplay(v: AllergieVerificaStato | null | undefined): string {
  if (!v || !isAllergieVerificaStato(v)) return '—'
  return ALLERGIE_VERIFICA_LABEL[v]
}

/** Avanzamento visita PMA (cartella clinica + badge dashboard). */
export type AvanzamentoPma = 'da_vedere' | 'in_visita' | 'attesa_dimissione'

export function isAvanzamentoPma(v: unknown): v is AvanzamentoPma {
  return v === 'da_vedere' || v === 'in_visita' || v === 'attesa_dimissione'
}

export const AVANZAMENTO_PMA_LABEL: Record<AvanzamentoPma, string> = {
  da_vedere: 'DA VEDERE',
  in_visita: 'IN VISITA',
  attesa_dimissione: 'ATTESA DIMISSIONE',
}

/** Sezione 1 — Tipo paziente (scelta rapida). */
export type TipoPaziente = 'trasportato' | 'autopresentato'

/** Sezione 1 — Codice colore triage. */
export type CodiceColorePaziente = 'bianco' | 'verde' | 'giallo' | 'rosso'

/**
 * Sezione 1 — STATO scheda.
 * Default creazione: `in_arrivo` se creatore Centrale, `in_carico` se Medico/Infermiere/Triage/Soccorritore.
 */
export type PazienteStato = 'in_arrivo' | 'in_attesa' | 'in_carico' | 'in_sospeso' | 'dimesso'

/**
 * Modello documento `pazienti/{id}` (UUID documento nascosto in UI).
 * Campi snake_case allineati a Firestore / PRD Sezioni 1–2.
 */
export interface Paziente {
  /** Uguale all’ID documento Firestore. */
  id: string
  id_manifestazione: string
  /** PMA di competenza (opzionale se creato da Centrale su tutta manifestazione). */
  id_pma?: string

  /** Sezione 1 — APERTO?: scheda modificabile. */
  aperto: boolean
  /** Sezione 1 — ID Paziente visibile (es. P_1, P_2). */
  id_paziente_visibile: string
  /** Sezione 1 — Apertura scheda (modificabile). */
  apertura_scheda: Timestamp
  tipo_paziente: TipoPaziente
  breve_descrizione: string
  codice_colore: CodiceColorePaziente

  /** Solo Centrale (+ Trasportato per ETA). */
  trasportato_da?: string | null
  note_centrale?: string | null
  /** Minuti ETA inseriti (Centrale + Trasportato). */
  eta_pma_minuti?: number | null
  /** Scadenza calcolata alla conferma/salvataggio ETA (ora corrente + minuti). */
  eta_pma_deadline?: Timestamp | null

  stato: PazienteStato

  /** Sezione 2 — Dati anagrafici */
  pettorale?: number | null
  nome: string
  cognome: string
  data_nascita?: Timestamp | null
  /** Calcolata dalla data di nascita. */
  eta?: number | null
  /** Email (campo dedicato v4). */
  email: string
  /** Telefono (campo dedicato v4). */
  telefono: string
  /** Legacy: combinato email/telefono (lettura migrazione). */
  email_tel: string
  /** Codice fiscale (16 caratteri), es. da barcode tessera sanitaria. */
  codice_fiscale: string

  /** Sezione 3 — Cartella clinica (valori sempre normalizzati dal parser). */
  apr: string
  allergie: string
  /** Conferma operatore: il paziente ha allergie note? Obbligatorio prima di modificare la cartella. */
  allergie_verifica?: AllergieVerificaStato | null
  /** Override manuale avanzamento visita (sovrascrive la logica automatica da allergie). */
  avanzamento_manuale?: AvanzamentoPma | null
  app: string
  /** Esame obiettivo — opzioni rapide per area (Firestore root, `EO_*`). */
  EO_GENERALE: string[]
  EO_NEUROLOGICO: string[]
  EO_CUTE: string[]
  EO_TORACE: string[]
  EO_ADDOME: string[]
  EO_CAPO_COLLO: string[]
  /**
   * Solo lettura da vecchio campo `eo_quick` se tutti gli `EO_*` sono vuoti.
   * La UI ripartisce con le liste manifestazione; i salvataggi avvengono sui campi `EO_*`.
   */
  eo_quick_legacy?: string[]
  eo_note: string
  parametri_vitali: ParametroVitaleRilevazione[]
  prestazioni_sel: string[]
  /** Foto ECG allegata (upload Cloudinary, URL sicuro). */
  ecg_cloudinary_url?: string | null
  farmaci: FarmacoSomministrato[]
  rivalutazioni: RivalutazioneVoce[]
  /** Lesioni (marker su omino SVG + descrizioni). Core v3. */
  lesioni: LesioneMarker[]

  /** Dati generali — liste da IMP_GENERALI manifestazione. */
  tipo_evento: string
  dettaglio_evento: string

  /** Sezione 5 — solo se esito dimissione = invio_ps; modificabile anche con scheda chiusa. */
  invio_ps_missione_areu: number | null
  invio_ps_data_ora: Timestamp | null
  invio_ps_mezzo: string
  invio_ps_ospedale: string
  invio_ps_codice_trasporto: 'verde' | 'giallo' | 'rosso' | null
  invio_ps_note: string

  /** Sezione 4 — Dimissione (SchedaPaziente v2). */
  dimissione_esito: DimissioneEsito | null
  dimissione_note: string
  affidatario_nome: string
  affidatario_cognome: string
  affidatario_legame: string
  /** Data URL / Base64 o (documenti legacy) URL immagine firma paziente. */
  firma_paziente_base64: string | null
  /** Copia firma medico alla dimissione: data URL/Base64 o URL legacy. */
  dimissione_firma_medico_base64: string | null
  dimesso_at: Timestamp | null
  /** Data/ora ultimo “ripreso in carico” da dimesso (solo Medico, da elenco dimessi). */
  ripreso_in_carico_at?: Timestamp | null

  /** Riferimento soft: chi ha preso per primo in carico come infermiere (solo informativo). */
  infermiere_rif: string
  /** Riferimento soft: chi ha preso per primo in carico come medico (solo informativo). */
  medico_rif: string

  /** Integrazione CROSS — origine scheda e dati non mappati su campi PMApp. */
  external_source?: string | null
  external_app_id?: string | null
  external_sync_at?: Timestamp | null
  /** Testo formattato (valutazioni MSB/MSA, evento, missione, SOREU, …). */
  cross_dati_scheda?: string | null
}

/** Scheda creata/sincronizzata da CROSS. */
export function isPazienteDaCross(p: Pick<Paziente, 'external_source'>): boolean {
  return String(p.external_source ?? '').trim().toUpperCase() === 'CROSS'
}

export const TIPO_PAZIENTE_LABEL: Record<TipoPaziente, string> = {
  trasportato: 'Trasportato',
  autopresentato: 'Autopresentato',
}

export const CODICE_COLORE_LABEL: Record<CodiceColorePaziente, string> = {
  bianco: 'Bianco',
  verde: 'Verde',
  giallo: 'Giallo',
  rosso: 'Rosso',
}

export const PAZIENTE_STATO_LABEL: Record<PazienteStato, string> = {
  in_arrivo: 'In arrivo',
  in_attesa: 'In attesa',
  in_carico: 'In carico',
  in_sospeso: 'In sospeso',
  dimesso: 'Dimesso',
}

/** Valore legacy `errore` → `in_sospeso` in lettura. */
export function parsePazienteStatoFromFirestore(v: unknown): PazienteStato {
  if (v === 'errore') return 'in_sospeso'
  if (
    v === 'in_arrivo' ||
    v === 'in_attesa' ||
    v === 'in_carico' ||
    v === 'in_sospeso' ||
    v === 'dimesso'
  ) {
    return v
  }
  return 'in_carico'
}

export function isTipoPaziente(v: unknown): v is TipoPaziente {
  return v === 'trasportato' || v === 'autopresentato'
}

export function isCodiceColorePaziente(v: unknown): v is CodiceColorePaziente {
  return v === 'bianco' || v === 'verde' || v === 'giallo' || v === 'rosso'
}

export function isPazienteStato(v: unknown): v is PazienteStato {
  return (
    v === 'in_arrivo' ||
    v === 'in_attesa' ||
    v === 'in_carico' ||
    v === 'in_sospeso' ||
    v === 'dimesso'
  )
}

/** Saturazione letti PMA: contano solo chi occupa un posto (esclusi dimessi e ancora in logistica “in arrivo”). */
/** Posto letto conteggiato solo per pazienti effettivamente in carico (non in arrivo / in attesa / sospeso). */
export function pazienteOccupaPostoLetto(stato: PazienteStato): boolean {
  return stato === 'in_carico'
}
