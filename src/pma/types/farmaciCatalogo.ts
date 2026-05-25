import type { FarmacoVia } from './cartellaClinica'
import { FARMACO_VIE, isFarmacoVia } from './cartellaClinica'

/** Voce catalogo PMA (impostazioni → farmaci consumati). */
export type PmaFarmacoCatalogoEntry = {
  id: string
  nome: string
  dosaggi: string[]
  via: FarmacoVia
}

export function newFarmacoCatalogoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `farm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function parseVia(raw: unknown): FarmacoVia {
  if (isFarmacoVia(raw)) return raw
  return 'EV'
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

/** Accetta `farmaci_consumati` (oggetti) o legacy `farmaci` (stringhe). */
export function parseFarmaciCatalogoFromFirestore(raw: unknown): PmaFarmacoCatalogoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: PmaFarmacoCatalogoEntry[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const nome = normalizeNome(item)
      if (!nome) continue
      out.push({ id: newFarmacoCatalogoId(), nome, dosaggi: [], via: 'EV' })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const nome = normalizeNome(String(o.nome ?? ''))
    if (!nome) continue
    const id = String(o.id ?? o.idUnivoco ?? '').trim() || newFarmacoCatalogoId()
    out.push({
      id,
      nome,
      dosaggi: normalizeDosaggi(o.dosaggi ?? o.dosaggio),
      via: parseVia(o.via),
    })
  }
  return dedupeCatalogoByNome(out)
}

export function dedupeCatalogoByNome(entries: PmaFarmacoCatalogoEntry[]): PmaFarmacoCatalogoEntry[] {
  const byKey = new Map<string, PmaFarmacoCatalogoEntry>()
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
    byKey.set(key, { ...prev, dosaggi: mergedDos, via: prev.via || e.via })
  }
  return Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}

export function findCatalogEntryByNome(
  catalog: PmaFarmacoCatalogoEntry[],
  nome: string,
): PmaFarmacoCatalogoEntry | null {
  const key = normalizeNome(nome).toLowerCase()
  if (!key) return null
  return catalog.find((e) => e.nome.trim().toLowerCase() === key) ?? null
}

export function filterCatalogByNomePrefix(
  catalog: PmaFarmacoCatalogoEntry[],
  query: string,
  limit = 12,
): PmaFarmacoCatalogoEntry[] {
  const q = normalizeNome(query).toLowerCase()
  if (!q) return catalog.slice(0, limit)
  return catalog.filter((e) => e.nome.toLowerCase().includes(q)).slice(0, limit)
}

/** Aggiunge o aggiorna voce catalogo dopo somministrazione in scheda. */
export function ensureFarmacoInCatalogo(
  catalog: PmaFarmacoCatalogoEntry[],
  params: { nome: string; dose?: string; via?: FarmacoVia },
): PmaFarmacoCatalogoEntry[] {
  const nome = normalizeNome(params.nome)
  if (!nome) return catalog
  const dose = String(params.dose ?? '').trim()
  const via = params.via && isFarmacoVia(params.via) ? params.via : 'EV'
  const existing = findCatalogEntryByNome(catalog, nome)
  if (!existing) {
    return dedupeCatalogoByNome([
      ...catalog,
      {
        id: newFarmacoCatalogoId(),
        nome,
        dosaggi: dose ? [dose] : [],
        via,
      },
    ])
  }
  const dosaggi = [...existing.dosaggi]
  if (dose && !dosaggi.includes(dose)) dosaggi.push(dose)
  return dedupeCatalogoByNome(
    catalog.map((e) =>
      e.id === existing.id ? { ...e, dosaggi, via: e.via || via } : e,
    ),
  )
}

export function serializeFarmaciCatalogo(entries: PmaFarmacoCatalogoEntry[]) {
  return dedupeCatalogoByNome(entries).map((e) => ({
    id: e.id,
    nome: e.nome,
    dosaggi: e.dosaggi,
    via: FARMACO_VIE.includes(e.via) ? e.via : 'EV',
  }))
}
