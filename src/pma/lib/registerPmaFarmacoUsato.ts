import { getDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { impostazioniDocRef } from '../../services/impostazioniService'
import { savePmaClinicaFarmaciConsumati } from '../../services/pmaClinicaImpostazioniService'
import type { FarmacoVia } from '../types/cartellaClinica'
import {
  incrementFarmacoConsumato,
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '../types/farmaciConsumatiStats'

/** Registra somministrazione in `pmaClinica.farmaci_consumati` (conteggio aggregato per nome). */
export async function registerPmaFarmacoUsato(
  db: Firestore,
  manifestazioneId: string,
  params: { nome: string; dose?: string; via?: FarmacoVia },
): Promise<void> {
  const tenant = String(manifestazioneId ?? '').trim()
  const nome = String(params.nome ?? '').trim()
  if (!tenant || !nome) return

  const snap = await getDoc(impostazioniDocRef(tenant))
  const pmaClinica = (snap.data()?.pmaClinica ?? {}) as Record<string, unknown>
  const current = parseFarmaciConsumatiFromFirestore(pmaClinica.farmaci_consumati)
  const next = incrementFarmacoConsumato(current, params)
  const serialized = serializeFarmaciConsumati(next)

  await savePmaClinicaFarmaciConsumati(tenant, serialized)
}
