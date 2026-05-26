import type { PmaFarmacoCatalogoEntry } from '../types/farmaciCatalogo'
import { dedupeCatalogoByNome } from '../types/farmaciCatalogo'
import type { FarmacoVia } from '../types/cartellaClinica'

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

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function inferViaFromDosaggio(text: string): FarmacoVia {
  const t = text.toLowerCase()
  if (/\b(i\.?m\.?|intramuscol)\b/.test(t)) return 'IM'
  if (/\b(s\.?c\.?|sottocut)\b/.test(t)) return 'SC'
  if (/\b(os\.?|orale|sublinguale)\b/.test(t)) return 'OS'
  return 'EV'
}

function splitDosaggi(dosaggioCell: string): string[] {
  const raw = String(dosaggioCell ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Importa CSV con colonne «Principio Attivo» e «Dosaggio possibile». */
export function parseFarmaciCsvText(text: string): PmaFarmacoCatalogoEntry[] {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  let start = 0
  const firstCols = parseCsvLine(lines[0])
  const h0 = (firstCols[0] ?? '').toLowerCase()
  if (h0.includes('principio') || h0.includes('nome') || h0.includes('farmaco')) {
    start = 1
  }

  const entries: PmaFarmacoCatalogoEntry[] = []
  for (let i = start; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i])
    const nome = (cols[0] ?? '').trim()
    if (!nome) continue
    const dosaggioCell = cols[1] ?? cols[2] ?? ''
    const dosaggi = splitDosaggi(dosaggioCell)
    const viaCol = (cols[2] ?? cols[3] ?? '').trim().toUpperCase()
    const via =
      viaCol === 'OS' || viaCol === 'IM' || viaCol === 'SC' || viaCol === 'EV'
        ? (viaCol as FarmacoVia)
        : inferViaFromDosaggio(dosaggioCell)
    entries.push({
      id: stableFarmacoId(nome),
      nome,
      dosaggi,
      via,
    })
  }
  return dedupeCatalogoByNome(entries)
}
