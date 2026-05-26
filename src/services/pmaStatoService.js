import { Timestamp } from 'firebase/firestore';
import { STATO_PZ_PMA } from '../lib/pmaModule';
import { patchPaziente } from './pazientiService';
import { patchPazientePmaGranular } from '../pma/lib/pazientePmaPatch';

/** Da «in attesa» a «in carico» (presa in carico al PMA). */
export async function prendiInCaricoPma(manifestationId, docId) {
  await patchPazientePmaGranular(manifestationId, docId, {
    statoPzPma: STATO_PZ_PMA.IN_CARICO,
    ingresso_carico_at: Timestamp.now(),
  });
}

/** Autopresentato: in attesa (fuori tenda) o in carico (in tenda). */
export async function setStatoPmaAutopresentato(manifestationId, docId, stato) {
  const next = String(stato ?? '').trim();
  if (next === STATO_PZ_PMA.IN_CARICO) {
    await prendiInCaricoPma(manifestationId, docId);
    return;
  }
  if (next === STATO_PZ_PMA.IN_ATTESA) {
    await patchPaziente(manifestationId, docId, { statoPzPma: STATO_PZ_PMA.IN_ATTESA });
  }
}
