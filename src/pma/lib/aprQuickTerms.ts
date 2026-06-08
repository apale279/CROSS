/** Voci rapide APR (anamnesi patologica remota) — prima riga del campo testo. */
export const APR_QUICK_TERMS = [
  { label: 'NEUROLOGICA', emoji: '🧠' },
  { label: 'CARDIOVASCOLARE', emoji: '🫀' },
  { label: 'RESPIRATORIA', emoji: '🫁' },
  { label: 'METABOLICA', emoji: '🩸' },
] as const

export type AprQuickLabel = (typeof APR_QUICK_TERMS)[number]['label']

const APR_QUICK_LABEL_SET = new Set<string>(APR_QUICK_TERMS.map((t) => t.label))

const APR_QUICK_BY_LABEL = Object.fromEntries(
  APR_QUICK_TERMS.map((t) => [t.label, t]),
) as Record<AprQuickLabel, (typeof APR_QUICK_TERMS)[number]>

export function isAprQuickLabel(value: string): value is AprQuickLabel {
  return APR_QUICK_LABEL_SET.has(value)
}

export function parseAprContent(apr: string | null | undefined): {
  terms: AprQuickLabel[]
  freeText: string
} {
  const raw = String(apr ?? '')
  if (!raw.trim()) return { terms: [], freeText: '' }

  const sep = raw.indexOf('\n\n')
  if (sep === -1) {
    const tokens = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tokens.length > 0 && tokens.every(isAprQuickLabel)) {
      return { terms: tokens, freeText: '' }
    }
    return { terms: [], freeText: raw }
  }

  const head = raw.slice(0, sep).trim()
  const tail = raw.slice(sep + 2)
  const tokens = head
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length > 0 && tokens.every(isAprQuickLabel)) {
    return { terms: tokens, freeText: tail }
  }
  return { terms: [], freeText: raw }
}

/** Ricompone APR: riga termini (ordine fisso) + testo libero invariato. */
export function formatAprContent(terms: Iterable<AprQuickLabel>, freeText: string): string {
  const selected = new Set(terms)
  const ordered = APR_QUICK_TERMS.map((t) => t.label).filter((l) => selected.has(l))
  const termsLine = ordered.join(', ')
  const free = String(freeText ?? '')
  if (termsLine && free.trim()) return `${termsLine}\n\n${free}`
  if (termsLine) return termsLine
  return free
}

export function normalizeAprContent(apr: string | null | undefined): string {
  const parsed = parseAprContent(apr)
  return formatAprContent(parsed.terms, parsed.freeText)
}

export function toggleAprQuickTerm(apr: string | null | undefined, label: AprQuickLabel): string {
  const { terms, freeText } = parseAprContent(apr)
  const set = new Set(terms)
  if (set.has(label)) set.delete(label)
  else set.add(label)
  return formatAprContent(set, freeText)
}

export function aprQuickEmojisFromApr(apr: string | null | undefined): string {
  const { terms } = parseAprContent(apr)
  return terms.map((label) => APR_QUICK_BY_LABEL[label].emoji).join('')
}

export function aprQuickEmojisFromPazienteDoc(paziente: {
  pmaScheda?: { apr?: string | null } | null
  apr?: string | null
} | null | undefined): string {
  const apr = paziente?.pmaScheda?.apr ?? paziente?.apr ?? ''
  return aprQuickEmojisFromApr(apr)
}
