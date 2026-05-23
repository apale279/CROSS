import type { Timestamp } from 'firebase/firestore'

/** Opzioni rapide Esame Obiettivo (EO) — chip selezionabili. */
export const EO_OPZIONI_RAPIDE = [
  'Cosciente e orientato',
  'Cianosi',
  'Dispnea',
  'Dolore toracico',
  'Addome dolente',
  'Edemi',
  'Pupille isocoriche',
  'Pupille anisocoriche',
  'Cute integra',
  'Lesioni cutanee',
  'Mobilizzazione conservata',
  'Deambulazione impossibile',
] as const

export type FarmacoVia = 'EV' | 'OS' | 'IM' | 'SC'

export const FARMACO_VIA_LABEL: Record<FarmacoVia, string> = {
  EV: 'EV',
  OS: 'OS',
  IM: 'IM',
  SC: 'SC',
}

export const FARMACO_VIE: FarmacoVia[] = ['EV', 'OS', 'IM', 'SC']

/** Singolo rilievo parametri vitali (Sez. 4.2). */
export interface ParametroVitaleRilevazione {
  id: string
  registrato_at: Timestamp
  operatore_nome: string
  gcs: number
  fr: number
  spo2_aa: number | null
  spo2_o2: number | null
  fc: number
  pa_sistolica: number
  pa_diastolica: number
  temperatura: number | null
  nrs: number | null
}

/** Farmaco somministrato (Sez. 4.3). */
export interface FarmacoSomministrato {
  id: string
  nome: string
  dose: string
  via: FarmacoVia
  registrato_at: Timestamp
  /** Chi ha inserito la riga (UI scheda; omesso dal PDF). */
  inserito_da_nome?: string
}

/** Nota di rivalutazione (Sez. 4.4). */
export interface RivalutazioneVoce {
  id: string
  testo: string
  creato_at: Timestamp
  firma_uid: string
  firma_nome: string
}

export function isFarmacoVia(v: unknown): v is FarmacoVia {
  return v === 'EV' || v === 'OS' || v === 'IM' || v === 'SC'
}
