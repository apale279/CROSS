import { EO_CLINICAL_TABS, type EoTabKey } from './multilineList'
import type {
  FarmacoSomministrato,
  ParametroVitaleRilevazione,
  RivalutazioneVoce,
} from '../types/cartellaClinica'
import type { LesioneMarker } from '../types/lesioni'
import type { Paziente } from '../types/paziente'

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function isPvRowFilled(row: ParametroVitaleRilevazione): boolean {
  return (
    row.gcs != null ||
    row.fr != null ||
    row.spo2_aa != null ||
    row.spo2_o2 != null ||
    row.fc != null ||
    row.pa_sistolica != null ||
    row.pa_diastolica != null ||
    row.temperatura != null ||
    row.nrs != null
  )
}

function isFarmacoRowFilled(row: FarmacoSomministrato): boolean {
  return hasText(row.nome)
}

export function isCartellaAnamnesiCompiled(
  p: Pick<Paziente, 'allergie_verifica' | 'allergie' | 'apr' | 'app'>,
): boolean {
  return (
    p.allergie_verifica != null ||
    hasText(p.allergie) ||
    hasText(p.apr) ||
    hasText(p.app)
  )
}

export function isCartellaEoCompiled(
  eoNote: string,
  eoSelectedByTab: Record<EoTabKey, string[]>,
): boolean {
  if (hasText(eoNote)) return true
  return EO_CLINICAL_TABS.some((tab) => (eoSelectedByTab[tab]?.length ?? 0) > 0)
}

export function isCartellaPvFarmaciCompiled(
  parametri_vitali: ParametroVitaleRilevazione[],
  farmaci: FarmacoSomministrato[],
): boolean {
  if (parametri_vitali.some(isPvRowFilled)) return true
  return farmaci.some(isFarmacoRowFilled)
}

export function isCartellaLesioniCompiled(
  lesioni: LesioneMarker[],
  prestazioni_sel: string[],
  ecg_cloudinary_url: string | null | undefined,
  rivalutazioni: RivalutazioneVoce[],
  opts?: { triageOnly?: boolean },
): boolean {
  if (opts?.triageOnly) {
    return rivalutazioni.some((r) => hasText(r.testo))
  }
  return (
    lesioni.length > 0 ||
    prestazioni_sel.length > 0 ||
    hasText(ecg_cloudinary_url) ||
    rivalutazioni.some((r) => hasText(r.testo))
  )
}

export type CartellaSubTabId = 'anamnesi' | 'eo' | 'pv_farmaci' | 'lesioni'

export function cartellaSubTabCompiledMap(
  p: Pick<
    Paziente,
    | 'allergie_verifica'
    | 'allergie'
    | 'apr'
    | 'app'
    | 'eo_note'
    | 'parametri_vitali'
    | 'farmaci'
    | 'lesioni'
    | 'prestazioni_sel'
    | 'ecg_cloudinary_url'
    | 'rivalutazioni'
  >,
  eoSelectedByTab: Record<EoTabKey, string[]>,
  hideClinicalBlocks: boolean,
): Record<CartellaSubTabId, boolean> {
  return {
    anamnesi: isCartellaAnamnesiCompiled(p),
    eo: isCartellaEoCompiled(p.eo_note, eoSelectedByTab),
    pv_farmaci: isCartellaPvFarmaciCompiled(p.parametri_vitali, p.farmaci),
    lesioni: isCartellaLesioniCompiled(
      p.lesioni,
      p.prestazioni_sel,
      p.ecg_cloudinary_url,
      p.rivalutazioni,
      { triageOnly: hideClinicalBlocks },
    ),
  }
}
