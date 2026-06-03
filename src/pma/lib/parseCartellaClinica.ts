import { Timestamp } from 'firebase/firestore'
import type {
  FarmacoSomministrato,
  FarmacoVia,
  ParametroVitaleRilevazione,
  RivalutazioneVoce,
} from '../types/cartellaClinica'
import { isFarmacoVia } from '../types/cartellaClinica'

function ts(v: unknown): Timestamp | null {
  if (v && typeof (v as Timestamp).toMillis === 'function') return v as Timestamp
  return null
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function intOrNull(v: unknown, min?: number, max?: number): number | null {
  const n = numOrNull(v)
  if (n == null) return null
  let x = Math.floor(n)
  if (min != null) x = Math.max(min, x)
  if (max != null) x = Math.min(max, x)
  return x
}

function str(v: unknown, def = ''): string {
  return typeof v === 'string' ? v : def
}

export function parseParametriVitali(raw: unknown): ParametroVitaleRilevazione[] {
  if (!Array.isArray(raw)) return []
  const out: ParametroVitaleRilevazione[] = []
  for (const el of raw) {
    if (!el || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    const id = str(o.id)
    if (!id) continue
    const registrato_at = ts(o.registrato_at) ?? Timestamp.now()
    out.push({
      id,
      registrato_at,
      operatore_nome: str(o.operatore_nome, '—'),
      gcs: intOrNull(o.gcs, 1, 15),
      fr: intOrNull(o.fr, 0),
      spo2_aa: intOrNull(o.spo2_aa, 0, 100),
      spo2_o2: intOrNull(o.spo2_o2, 0, 100),
      fc: intOrNull(o.fc, 0),
      pa_sistolica: intOrNull(o.pa_sistolica, 0, 999),
      pa_diastolica: intOrNull(o.pa_diastolica, 0, 999),
      temperatura: numOrNull(o.temperatura),
      nrs: intOrNull(o.nrs, 0, 10),
    })
  }
  return out
}

export function parseFarmaci(raw: unknown): FarmacoSomministrato[] {
  if (!Array.isArray(raw)) return []
  const out: FarmacoSomministrato[] = []
  for (const el of raw) {
    if (!el || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    const id = str(o.id)
    if (!id) continue
    const viaRaw = o.via
    const via: FarmacoVia = isFarmacoVia(viaRaw) ? viaRaw : 'EV'
    const registrato_at = ts(o.registrato_at) ?? Timestamp.now()
    out.push({
      id,
      nome: str(o.nome),
      dose: str(o.dose),
      via,
      registrato_at,
      ...(typeof o.inserito_da_nome === 'string' && o.inserito_da_nome.trim()
        ? { inserito_da_nome: o.inserito_da_nome.trim() }
        : {}),
    })
  }
  return out
}

export function parseRivalutazioni(raw: unknown): RivalutazioneVoce[] {
  if (!Array.isArray(raw)) return []
  const out: RivalutazioneVoce[] = []
  for (const el of raw) {
    if (!el || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    const id = str(o.id)
    if (!id) continue
    const creato_at = ts(o.creato_at) ?? Timestamp.now()
    out.push({
      id,
      testo: str(o.testo),
      creato_at,
      firma_uid: str(o.firma_uid),
      firma_nome: str(o.firma_nome, '—'),
    })
  }
  return out
}

export function parseEoQuick(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

export function parsePrestazioniSel(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}
