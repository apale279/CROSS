import { TENANT_ID } from '../constants';

const envFlag = (import.meta.env.VITE_APP_SANDBOX ?? '').trim().toLowerCase();
const productionTenantId = (import.meta.env.VITE_PRODUCTION_TENANT_ID ?? '').trim();
const configuredTenantId = TENANT_ID;

/** Build/deploy esplicitamente in modalità sandbox (Vercel sandbox o dev:sandbox). */
export function isSandboxAppEnv() {
  return envFlag === 'true' || envFlag === '1';
}

export function getProductionTenantId() {
  return productionTenantId;
}

/** Blocca scritture sul tenant di produzione quando l'app è in modalità sandbox. */
export function isProductionTenantId(tenantId) {
  const id = String(tenantId ?? '').trim();
  if (!id || !productionTenantId) return false;
  return id === productionTenantId;
}

export function assertWritableTenant(tenantId) {
  if (!isSandboxAppEnv()) return;
  const id = String(tenantId ?? '').trim();
  if (!id) return;
  if (isProductionTenantId(id)) {
    throw new Error(
      'Scrittura bloccata: stai usando il tenant di produzione in modalità SANDBOX. ' +
        'Imposta VITE_TENANT_ID sul tenant sandbox e rifai il deploy.',
    );
  }
}

/** Configurazione incoerente: sandbox attiva ma tenant build = produzione. */
export function isSandboxMisconfigured() {
  if (!isSandboxAppEnv() || !productionTenantId || !configuredTenantId) return false;
  return configuredTenantId === productionTenantId;
}

export function shouldShowSandboxBadge({ manifestSandbox } = {}) {
  return isSandboxAppEnv() || manifestSandbox === true;
}

/** @deprecated usa shouldShowSandboxBadge */
export function shouldShowSandboxBanner(opts) {
  return shouldShowSandboxBadge(opts);
}
