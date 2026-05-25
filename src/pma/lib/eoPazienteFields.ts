import { EO_CLINICAL_TABS, type EoTabKey } from './multilineList'
import { parseEoQuick } from './parseCartellaClinica'

/** Campi root su `pazienti/{id}` — ordine allineato a `EO_CLINICAL_TABS`. */
export const EO_PAZIENTE_FIRESTORE_FIELDS = [
  'EO_GENERALE',
  'EO_NEUROLOGICO',
  'EO_TORACE',
  'EO_CUTE',
  'EO_ADDOME',
  'EO_CAPO_COLLO',
] as const

export type EoPazienteFirestoreField = (typeof EO_PAZIENTE_FIRESTORE_FIELDS)[number]

export function firestoreFieldForEoTab(tab: EoTabKey): EoPazienteFirestoreField {
  const i = EO_CLINICAL_TABS.indexOf(tab)
  return EO_PAZIENTE_FIRESTORE_FIELDS[i] ?? 'EO_GENERALE'
}

export function eoTabForFirestoreField(field: string): EoTabKey | null {
  const i = EO_PAZIENTE_FIRESTORE_FIELDS.indexOf(field as EoPazienteFirestoreField)
  if (i < 0) return null
  return EO_CLINICAL_TABS[i] ?? null
}

export type EoQuickGroupRowLike = { title: string; labels: readonly string[] }

export function readEoColumnArraysFromDoc(d: Record<string, unknown>): Record<EoPazienteFirestoreField, string[]> {
  const out = {} as Record<EoPazienteFirestoreField, string[]>
  for (const field of EO_PAZIENTE_FIRESTORE_FIELDS) {
    out[field] = parseEoQuick(d[field])
  }
  return out
}

function totalSelections(cols: Record<EoPazienteFirestoreField, string[]>): number {
  let n = 0
  for (const f of EO_PAZIENTE_FIRESTORE_FIELDS) n += cols[f].length
  return n
}

export function totalEoColumnSelections(cols: Record<EoPazienteFirestoreField, string[]>): number {
  return totalSelections(cols)
}

export function columnsFromPazienteFields(
  p: Record<EoPazienteFirestoreField, string[] | undefined>,
): Record<EoPazienteFirestoreField, string[]> {
  const cols = {} as Record<EoPazienteFirestoreField, string[]>
  for (const f of EO_PAZIENTE_FIRESTORE_FIELDS) cols[f] = [...(p[f] ?? [])]
  return cols
}

/**
 * Valori EO per UI: campi `EO_*` sul paziente, oppure split da `eo_quick_legacy` con le liste manifestazione.
 */
export function resolveEoColumnsForDisplay(
  p: Record<EoPazienteFirestoreField, string[] | undefined> & { eo_quick_legacy?: string[] | undefined },
  groups: readonly EoQuickGroupRowLike[],
): Record<EoPazienteFirestoreField, string[]> {
  const cols = columnsFromPazienteFields(p)
  if (totalSelections(cols) > 0) return cols
  if (p.eo_quick_legacy?.length) return mergeLegacyEoQuickIntoColumns(p.eo_quick_legacy, groups)
  return cols
}

/**
 * Se il documento ha ancora solo `eo_quick` piatto e nessun EO_* valorizzato, ripartisce per tab
 * (prima colonna in ordine clinico che contiene l'etichetta vince; voci non in elenco → GENERALE).
 */
export function mergeLegacyEoQuickIntoColumns(
  legacyFlat: string[],
  groups: readonly EoQuickGroupRowLike[],
): Record<EoPazienteFirestoreField, string[]> {
  const byTab: Record<EoTabKey, string[]> = {} as Record<EoTabKey, string[]>
  for (const t of EO_CLINICAL_TABS) byTab[t] = []

  const consumed = new Set<string>()
  for (const label of legacyFlat) {
    const t = label.trim()
    if (!t || consumed.has(t)) continue
    let placed = false
    for (const g of groups) {
      const tab = g.title as EoTabKey
      if (!EO_CLINICAL_TABS.includes(tab)) continue
      if (g.labels.some((x) => x === t)) {
        byTab[tab].push(t)
        consumed.add(t)
        placed = true
        break
      }
    }
    if (!placed) {
      byTab.GENERALE.push(t)
      consumed.add(t)
    }
  }

  const cols = {} as Record<EoPazienteFirestoreField, string[]>
  for (let i = 0; i < EO_CLINICAL_TABS.length; i++) {
    cols[EO_PAZIENTE_FIRESTORE_FIELDS[i]] = [...byTab[EO_CLINICAL_TABS[i]]]
  }
  return cols
}

export type EoRiepilogoRow = { tab: EoTabKey; values: string[]; line: string }

/** Righe «TIPO: voce1, voce2» per riepilogo UI/PDF (solo aree con almeno una voce). */
export function buildEoRiepilogoLinesFromSelectedByTab(
  selectedByTab: Partial<Record<EoTabKey, string[]>>,
): EoRiepilogoRow[] {
  const rows: EoRiepilogoRow[] = []
  for (const tab of EO_CLINICAL_TABS) {
    const values = (selectedByTab[tab] ?? []).map((x) => String(x).trim()).filter(Boolean)
    if (values.length === 0) continue
    rows.push({ tab, values, line: `${tab}: ${values.join(', ')}` })
  }
  return rows
}

export function buildEoRiepilogoLinesFromColumns(
  cols: Record<EoPazienteFirestoreField, string[]>,
): EoRiepilogoRow[] {
  const byTab = {} as Partial<Record<EoTabKey, string[]>>
  for (let i = 0; i < EO_CLINICAL_TABS.length; i++) {
    byTab[EO_CLINICAL_TABS[i]] = cols[EO_PAZIENTE_FIRESTORE_FIELDS[i]] ?? []
  }
  return buildEoRiepilogoLinesFromSelectedByTab(byTab)
}

/** Testo PDF / riepilogo: ordine per area clinica. */
export function formatEoColumnsForPdf(cols: Record<EoPazienteFirestoreField, string[]>): string {
  const lines = buildEoRiepilogoLinesFromColumns(cols)
  return lines.length ? lines.map((r) => r.line).join('\n') : '—'
}
