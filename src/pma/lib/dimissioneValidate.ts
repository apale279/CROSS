import { isDimissioneEsito } from '../types/dimissione';
import type { Paziente } from '../types/paziente';

export type DimissioneValidateInput = Pick<
  Paziente,
  'dimissione_esito' | 'medico_rif'
>;

/** Controlli obbligatori prima di «Dimetti paziente» (UI e patch Firestore). */
export function validateDimissioneBeforeClose(p: DimissioneValidateInput): string[] {
  const errors: string[] = [];

  if (!isDimissioneEsito(p.dimissione_esito)) {
    errors.push('Seleziona l\'esito della dimissione.');
  }

  if (!String(p.medico_rif ?? '').trim()) {
    errors.push('Indica il medico di riferimento (nome medico in scheda).');
  }

  return errors;
}
