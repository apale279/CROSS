import seedRows from './farmaciCatalogoSeed.json'
import type { PmaFarmacoCatalogoEntry } from '../types/farmaciCatalogo'
import type { FarmacoVia } from '../types/cartellaClinica'

type SeedRow = { nome: string; dosaggi: string[]; via?: string }

function stableFarmacoId(nome: string): string {
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

/** Catalogo iniziale da CSV `Prompt_local/elenco_farmaci_pma.csv`. */
export function defaultFarmaciConsumatiCatalog(): PmaFarmacoCatalogoEntry[] {
  return (seedRows as SeedRow[]).map((row) => ({
    id: stableFarmacoId(row.nome),
    nome: row.nome.trim(),
    dosaggi: [...(row.dosaggi ?? [])],
    via: (row.via === 'OS' || row.via === 'IM' || row.via === 'SC' ? row.via : 'EV') as FarmacoVia,
  }))
}
