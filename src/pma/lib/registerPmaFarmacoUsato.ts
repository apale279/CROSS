import { doc, getDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { impostazioniPath } from '../../lib/firestorePaths'
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

  const ref = doc(db, ...impostazioniPath(tenant))
  const snap = await getDoc(ref)
  const pmaClinica = (snap.data()?.pmaClinica ?? {}) as Record<string, unknown>
  const current = parseFarmaciConsumatiFromFirestore(pmaClinica.farmaci_consumati)
  const next = incrementFarmacoConsumato(current, params)
  const serialized = serializeFarmaciConsumati(next)

  await updateDoc(ref, {
    'pmaClinica.farmaci_consumati': serialized,
  })
}
