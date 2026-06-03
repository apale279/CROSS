import { Timestamp } from 'firebase/firestore'
import type { ParametroVitaleRilevazione } from '../types/cartellaClinica'

/** Nuova rilevazione PV senza valori precompilati (0 = misurato, null = non rilevato). */
export function emptyParametroVitaleDraft(operatoreNome: string): ParametroVitaleRilevazione {
  return {
    id: crypto.randomUUID(),
    registrato_at: Timestamp.now(),
    operatore_nome: operatoreNome.trim() || '—',
    gcs: null,
    fr: null,
    spo2_aa: null,
    spo2_o2: null,
    fc: null,
    pa_sistolica: null,
    pa_diastolica: null,
    temperatura: null,
    nrs: null,
  }
}
