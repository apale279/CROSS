import { doc, getDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { FarmacoVia } from '../types/cartellaClinica'
import {
  ensureFarmacoInCatalogo,
  parseFarmaciCatalogoFromFirestore,
  serializeFarmaciCatalogo,
} from '../types/farmaciCatalogo'

/** Registra somministrazione in `pmaClinica.farmaci_consumati` (crea voce se assente). */
export async function registerPmaFarmacoUsato(
  db: Firestore,
  manifestazioneId: string,
  params: { nome: string; dose?: string; via?: FarmacoVia },
): Promise<void> {
  const tenant = String(manifestazioneId ?? '').trim()
  const nome = String(params.nome ?? '').trim()
  if (!tenant || !nome) return

  const ref = doc(db, 'manifestazioni', tenant, 'settings', 'impostazioni')
  const snap = await getDoc(ref)
  const pmaClinica = (snap.data()?.pmaClinica ?? {}) as Record<string, unknown>
  const raw = pmaClinica.farmaci_consumati ?? pmaClinica.farmaci
  const current = parseFarmaciCatalogoFromFirestore(raw)
  const next = ensureFarmacoInCatalogo(current, params)
  const serialized = serializeFarmaciCatalogo(next)

  await updateDoc(ref, {
    'pmaClinica.farmaci_consumati': serialized,
  })
}
