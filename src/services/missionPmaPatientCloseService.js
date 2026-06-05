import {
  buildProvenienzaTrasportoCentrale,
  contestoEventoPerMissione,
  fieldsAnnullaInvioPma,
  fieldsMantieniPazienteAlPma,
  pazientiPmaSuMissione,
  pazientiPmaSuMissioni,
} from '../lib/missionPmaPatientClose';
import { promptMissionPmaPatientsClose } from '../lib/missionPmaPatientClosePrompt';
import { patchPaziente } from './pazientiService';

async function applyDecisionForPatient(
  manifestationId,
  paziente,
  decision,
  { missione, evento, motivoChiusura },
) {
  if (decision === 'keep') {
    const provenienza = buildProvenienzaTrasportoCentrale({
      paziente,
      missione,
      evento,
      motivoChiusura,
    });
    await patchPaziente(
      manifestationId,
      paziente._docId,
      fieldsMantieniPazienteAlPma(paziente, provenienza),
    );
    return;
  }
  await patchPaziente(manifestationId, paziente._docId, fieldsAnnullaInvioPma());
}

/**
 * Gestisce pazienti PMA prima di chiudere/annullare/eliminare missioni.
 * @returns {Promise<{ proceed: boolean }>} proceed false se l'operatore ha annullato
 */
export async function resolveMissionPmaPatientsBeforeClose({
  manifestationId,
  missioni,
  pazienti,
  eventi,
  motivoChiusura,
  impostazioni,
  titolo,
  prompt = promptMissionPmaPatientsClose,
}) {
  const listaMissioni = Array.isArray(missioni) ? missioni : missioni ? [missioni] : [];
  const targets = pazientiPmaSuMissioni(pazienti, listaMissioni);
  if (targets.length === 0) return { proceed: true };

  const decision = prompt(targets, { titolo, impostazioni });
  if (!decision) return { proceed: false };

  const missionePerPaziente = new Map();
  for (const mis of listaMissioni) {
    for (const p of pazientiPmaSuMissione(pazienti, mis)) {
      if (!missionePerPaziente.has(p._docId)) {
        missionePerPaziente.set(p._docId, mis);
      }
    }
  }

  for (const p of targets) {
    const missione = missionePerPaziente.get(p._docId) ?? listaMissioni[0] ?? null;
    const evento = contestoEventoPerMissione(missione, eventi);
    await applyDecisionForPatient(manifestationId, p, decision, {
      missione,
      evento,
      motivoChiusura,
    });
  }

  return { proceed: true };
}
