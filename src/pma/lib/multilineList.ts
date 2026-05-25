/**
 * Parsing "un valore per riga": trim, righe vuote scartate, duplicati ignorati (prima occorrenza vince;
 * ordine utente preservato per la prima riga = default EO).
 */
export function parseLinesToValues(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const t = line.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** Ordine colonne EO rapido in cartella clinica (allineato al modello strutturato). */
export const EO_CLINICAL_TABS = [
  'GENERALE',
  'NEUROLOGICO',
  'TORACE',
  'CUTE',
  'ADDOME',
  'CAPO/COLLO',
] as const

export type EoTabKey = (typeof EO_CLINICAL_TABS)[number]

/** Righe «NESSUNO»/«NESSUNA» non sono default EO (primo valore reale della lista). */
function isEoNessunaDraftLine(t: string): boolean {
  const u = t.trim().toUpperCase()
  return u === 'NESSUNA' || u === 'NESSUNO'
}

/** Primo valore non vuoto seguendo l'ordine delle tab cliniche (GENERALE → …), senza riordinamento alfabetico. */
export function firstEoRapidoDefaultFromDrafts(drafts: Record<string, string>): string | null {
  for (const tab of EO_CLINICAL_TABS) {
    const parsed = parseLinesToValues(drafts[tab] ?? '').filter((x) => !isEoNessunaDraftLine(x))
    if (parsed.length > 0) return parsed[0] ?? null
  }
  return null
}
