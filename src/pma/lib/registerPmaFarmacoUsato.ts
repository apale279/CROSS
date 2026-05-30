import type { Firestore } from 'firebase/firestore'
import { incrementPmaClinicaFarmacoConsumato } from '../../services/pmaClinicaImpostazioniService'
import type { FarmacoVia } from '../types/cartellaClinica'
/** Registra somministrazione in `pmaClinica.farmaci_consumati` (conteggio aggregato per nome). */
export async function registerPmaFarmacoUsato(
  db: Firestore,
  manifestazioneId: string,
  params: { nome: string; dose?: string; via?: FarmacoVia },
): Promise<void> {
  const tenant = String(manifestazioneId ?? '').trim()
  const nome = String(params.nome ?? '').trim()
  if (!tenant || !nome) return

  await incrementPmaClinicaFarmacoConsumato(tenant, params)
}
