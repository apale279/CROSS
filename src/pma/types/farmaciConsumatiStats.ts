import type { FarmacoVia } from './cartellaClinica'
import { FARMACO_VIE, isFarmacoVia } from './cartellaClinica'
import { newFarmacoCatalogoId } from './farmaciCatalogo'

/** Statistiche utilizzo farmaci (impostazioni → farmaci_consumati). */
export type PmaFarmacoConsumatoStat = {
  id: string
  nome: string
  conteggio: number
  dosaggi: string[]
  via: FarmacoVia
}

function normalizeNome(nome: string): string {
  return nome.trim()
}

function normalizeDosaggi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const t = String(item ?? '').trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

function parseVia(raw: unknown): FarmacoVia {
  if (isFarmacoVia(raw)) return raw
  return 'EV'
}

function stableConsumatoId(nome: string): string {
  const slug = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `farm-${slug || 'voce'}`
}

function isCatalogOnlyRow(o: Record<string, unknown>): boolean {
  const c = o.conteggio ?? o.usoCount ?? o.utilizzi
  return c == null || c === '' || Number(c) === 0
}

/** Legge `farmaci_consumati` come statistiche; ignora righe legacy senza conteggio. */
export function parseFarmaciConsumatiFromFirestore(raw: unknown): PmaFarmacoConsumatoStat[] {
  if (!Array.isArray(raw)) return []
  const out: PmaFarmacoConsumatoStat[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const nome = normalizeNome(String(o.nome ?? ''))
    if (!nome) continue
    const conteggioRaw = o.conteggio ?? o.usoCount ?? o.utilizzi
    if (isCatalogOnlyRow(o) && (conteggioRaw == null || Number(conteggioRaw) === 0)) {
      continue
    }
    const conteggio = Math.max(1, Math.floor(Number(conteggioRaw ?? 1)))
    const id = String(o.id ?? '').trim() || stableConsumatoId(nome)
    out.push({
      id,
      nome,
      conteggio,
      dosaggi: normalizeDosaggi(o.dosaggi ?? o.dosaggio),
      via: parseVia(o.via),
    })
  }
  return dedupeConsumatiByNome(out)
}

export function dedupeConsumatiByNome(entries: PmaFarmacoConsumatoStat[]): PmaFarmacoConsumatoStat[] {
  const byKey = new Map<string, PmaFarmacoConsumatoStat>()
  for (const e of entries) {
    const key = e.nome.trim().toLowerCase()
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { ...e, dosaggi: [...e.dosaggi] })
      continue
    }
    const mergedDos = [...prev.dosaggi]
    for (const d of e.dosaggi) {
      if (d && !mergedDos.includes(d)) mergedDos.push(d)
    }
    byKey.set(key, {
      ...prev,
      conteggio: prev.conteggio + e.conteggio,
      dosaggi: mergedDos,
      via: prev.via || e.via,
    })
  }
  return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}

/** Incrementa utilizzi per nome (stesso farmaco → un’unica riga con conteggio sommato). */
export function incrementFarmacoConsumato(
  stats: PmaFarmacoConsumatoStat[],
  params: { nome: string; dose?: string; via?: FarmacoVia },
): PmaFarmacoConsumatoStat[] {
  const nome = normalizeNome(params.nome)
  if (!nome) return stats
  const dose = String(params.dose ?? '').trim()
  const via = params.via && isFarmacoVia(params.via) ? params.via : 'EV'
  const key = nome.toLowerCase()
  const existing = stats.find((s) => s.nome.trim().toLowerCase() === key)
  if (!existing) {
    return dedupeConsumatiByNome([
      ...stats,
      {
        id: stableConsumatoId(nome),
        nome,
        conteggio: 1,
        dosaggi: dose ? [dose] : [],
        via,
      },
    ])
  }
  const dosaggi = [...existing.dosaggi]
  if (dose && !dosaggi.includes(dose)) dosaggi.push(dose)
  return dedupeConsumatiByNome(
    stats.map((s) =>
      s.nome.trim().toLowerCase() === key
        ? { ...s, conteggio: s.conteggio + 1, dosaggi, via: s.via || via }
        : s,
    ),
  )
}

export function serializeFarmaciConsumati(entries: PmaFarmacoConsumatoStat[]) {
  return dedupeConsumatiByNome(entries).map((e) => ({
    id: e.id,
    nome: e.nome,
    conteggio: e.conteggio,
    dosaggi: e.dosaggi,
    via: FARMACO_VIE.includes(e.via) ? e.via : 'EV',
  }))
}

/** Migrazione: catalogo legacy in `farmaci_consumati` → elenco selezionabile `farmaci`. */
export function legacyCatalogFromConsumatiField(raw: unknown) {
  if (!Array.isArray(raw)) return []
  const hasUsage = raw.some((item) => {
    if (!item || typeof item !== 'object') return false
    const o = item as Record<string, unknown>
    const c = Number(o.conteggio ?? o.usoCount ?? o.utilizzi ?? 0)
    return Number.isFinite(c) && c > 0
  })
  if (hasUsage) return []
  return raw
}

export function newFarmacoConsumatoId(): string {
  return newFarmacoCatalogoId()
}
