import { STATO_PZ_PMA } from '../../lib/pmaModule';
import { validateDimissioneBeforeClose } from './dimissioneValidate';

const PMA_SCHEDA_PREFIX = 'pmaScheda.';

function applyPathToScheda(scheda: Record<string, unknown>, path: string, value: unknown) {
  if (!path.startsWith(PMA_SCHEDA_PREFIX)) return scheda;
  const field = path.slice(PMA_SCHEDA_PREFIX.length);
  return { ...scheda, [field]: value };
}

/** True se il piano di patch chiude la dimissione (stato PMA dimesso). */
export function planClosesDimissione(plan: {
  direct?: Record<string, unknown>;
}): boolean {
  const direct = plan.direct ?? {};
  if (direct.statoPzPma === STATO_PZ_PMA.DIMESSO) return true;
  if (direct.stato === 'dimesso') return true;
  if (direct[`${PMA_SCHEDA_PREFIX}dimesso_at`] != null) return true;
  return false;
}

/** Vista merge server + patch in transazione per validazione dimissione. */
export function buildDimissioneValidateView(
  snapData: Record<string, unknown> | null | undefined,
  plan: { direct?: Record<string, unknown> },
) {
  let scheda: Record<string, unknown> = { ...(snapData?.pmaScheda as Record<string, unknown>) };
  for (const [path, value] of Object.entries(plan.direct ?? {})) {
    scheda = applyPathToScheda(scheda, path, value);
  }

  return {
    dimissione_esito: scheda.dimissione_esito as string | null | undefined,
    medico_rif: scheda.medico_rif as string | null | undefined,
  };
}

export function assertDimissionePatchAllowed(
  snapData: Record<string, unknown> | null | undefined,
  plan: { direct?: Record<string, unknown> },
) {
  if (!planClosesDimissione(plan)) return;
  const errors = validateDimissioneBeforeClose(buildDimissioneValidateView(snapData, plan));
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
