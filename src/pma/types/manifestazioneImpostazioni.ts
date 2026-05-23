import type { FarmacoVia } from './cartellaClinica'
import { isFarmacoVia } from './cartellaClinica'

/**
 * Preset farmaci importabili in cartella (configurazione `manifestazioni.impostazioni.preset_farmaci`).
 */
export type PresetFarmacoRiga = {
  nome: string
  dose: string
  via: FarmacoVia
}

export type PresetFarmaciPack = {
  nome: string
  farmaci: PresetFarmacoRiga[]
}

function parseVia(raw: unknown): FarmacoVia {
  if (isFarmacoVia(raw)) return raw
  return 'EV'
}

export function parsePresetFarmaciFromFirestore(raw: unknown): PresetFarmaciPack[] {
  if (!Array.isArray(raw)) return []
  const out: PresetFarmaciPack[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const nomePack = typeof o.nome === 'string' ? o.nome.trim() : ''
    const farmRaw = o.farmaci
    const farmaci: PresetFarmacoRiga[] = []
    if (Array.isArray(farmRaw)) {
      for (const fr of farmRaw) {
        if (!fr || typeof fr !== 'object') continue
        const f = fr as Record<string, unknown>
        const nome = typeof f.nome === 'string' ? f.nome.trim() : ''
        const dose = typeof f.dose === 'string' ? f.dose.trim() : ''
        if (!nome && !dose) continue
        farmaci.push({ nome: nome || '—', dose, via: parseVia(f.via) })
      }
    }
    if (!nomePack && farmaci.length === 0) continue
    out.push({ nome: nomePack || 'Preset', farmaci })
  }
  return out
}

/**
 * Preset testuali per le note di dimissione (configurazione su `manifestazioni`).
 */
export type PresetDimissioneVoce = {
  titolo: string
  testo: string
}

export function parsePresetDimissioneFromFirestore(raw: unknown): PresetDimissioneVoce[] {
  if (!Array.isArray(raw)) return []
  const out: PresetDimissioneVoce[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const titolo = typeof o.titolo === 'string' ? o.titolo.trim() : ''
    const testo = typeof o.testo === 'string' ? o.testo : ''
    if (!titolo && !testo.trim()) continue
    out.push({ titolo: titolo || 'Preset', testo })
  }
  return out
}
