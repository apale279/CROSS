import { EO_CLINICAL_TABS } from './multilineList'
import { EO_OPZIONI_RAPIDE } from '../types/cartellaClinica'
import { normalizeEoQuickLabels } from './eoQuickSelection'

export type EoQuickGroupRow = { title: string; labels: string[] }

/** Stesso schema usato in impostazioni manifestazione / `useManifestazioneListeCliniche`. */
export function defaultEoQuickGroupRows(): EoQuickGroupRow[] {
  const fallback = [...EO_OPZIONI_RAPIDE]
  return EO_CLINICAL_TABS.map((title, i) => ({
    title,
    labels: normalizeEoQuickLabels(i === 0 ? fallback : []),
  }))
}
