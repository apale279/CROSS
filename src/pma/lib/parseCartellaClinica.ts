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

function num(v: unknown, def: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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
      gcs: Math.min(15, Math.max(1, Math.floor(num(o.gcs, 15)))),
      fr: Math.max(0, Math.floor(num(o.fr, 12))),
      spo2_aa: numOrNull(o.spo2_aa),
      spo2_o2: numOrNull(o.spo2_o2),
      fc: Math.max(0, Math.floor(num(o.fc, 80))),
      pa_sistolica: Math.max(0, Math.floor(num(o.pa_sistolica, 130))),
      pa_diastolica: Math.max(0, Math.floor(num(o.pa_diastolica, 80))),
      temperatura: numOrNull(o.temperatura),
      nrs:
        o.nrs === null || o.nrs === undefined || o.nrs === ''
          ? null
          : Math.min(10, Math.max(0, Math.floor(num(o.nrs, 0)))),
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
