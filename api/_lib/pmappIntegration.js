import { impostazioniDocRef } from './telegramFirestore.js';
import { stripEnvValue } from './env.js';

/**
 * Config integrazione PMApp (stesso progetto Firebase, collezione root `pazienti`).
 * @returns {{ enabled: boolean, pmappManifestazioneId: string }}
 */
export async function getPmappIntegrationSettings(tenantId) {
  const snap = await impostazioniDocRef(tenantId).get();
  const data = snap.exists ? snap.data() : {};
  const enabled = data.pmappIntegrationEnabled === true;

  let pmappManifestazioneId = String(data.pmappManifestazioneId ?? '').trim();
  if (!pmappManifestazioneId) {
    pmappManifestazioneId =
      stripEnvValue(process.env.PMAPP_MANIFESTAZIONE_ID) ||
      stripEnvValue(process.env.VITE_PMAPP_MANIFESTAZIONE_ID) ||
      '';
  }

  return { enabled, pmappManifestazioneId };
}
