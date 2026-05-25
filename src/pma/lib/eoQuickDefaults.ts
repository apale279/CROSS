import { structuredEoQuickGroupRows } from './eoStructuredDefaults'

export type EoQuickGroupRow = { title: string; labels: string[] }

/** Gruppi EO di fallback (PDF / manifestazione senza liste su Firestore). */
export function defaultEoQuickGroupRows(): EoQuickGroupRow[] {
  return structuredEoQuickGroupRows()
}
