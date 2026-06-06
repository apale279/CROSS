import { Timestamp } from 'firebase/firestore'
import type {
  FarmacoSomministrato,
  FarmacoVia,
  ParametroVitaleRilevazione,
  RivalutazioneVoce,
} from '../types/cartellaClinica'
import { isFarmacoVia } from '../types/cartellaClinica'
import { vitalMeasuredOrNull } from '../../lib/vitalNumeric'

function ts(v: unknown): Timestamp | null {
  if (v && typeof (v as Timestamp).toMillis === 'function') return v as Timestamp
  return null
}

function pvInt(v: unknown, min?: number, max?: number): number | null {
  return vitalMeasuredOrNull(v, {
    min: min ?? -Infinity,
    max: max ?? Infinity,
    integer: true,
  })
}

function pvNum(v: unknown, min?: number, max?: number): number | null {
  return vitalMeasuredOrNull(v, {
    min: min ?? -Infinity,
    max: max ?? Infinity,
  })
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
      gcs: pvInt(o.gcs, 3, 15),
      fr: pvInt(o.fr, 0),
      spo2_aa: pvInt(o.spo2_aa, 0, 100),
      spo2_o2: pvInt(o.spo2_o2, 0, 100),
      fc: pvInt(o.fc, 0),
      pa_sistolica: pvInt(o.pa_sistolica, 0, 999),
      pa_diastolica: pvInt(o.pa_diastolica, 0, 999),
      temperatura: pvNum(o.temperatura, 30, 45),
      nrs: pvInt(o.nrs, 0, 10),
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
