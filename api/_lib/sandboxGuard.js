import { stripEnvValue } from './env.js';

function isSandboxServerEnv() {
  const flag = stripEnvValue(process.env.VITE_APP_SANDBOX).toLowerCase();
  return flag === 'true' || flag === '1';
}

function getProductionTenantId() {
  return stripEnvValue(process.env.VITE_PRODUCTION_TENANT_ID);
}

/** Impedisce alle API del deploy sandbox di operare sul tenant produzione. */
export function assertSandboxWritableTenant(tenantId) {
  if (!isSandboxServerEnv()) return;
  const id = String(tenantId ?? '').trim();
  const prod = getProductionTenantId();
  if (!id || !prod || id !== prod) return;
  const err = new Error(
    'API sandbox: scrittura sul tenant di produzione bloccata. Controlla VITE_TENANT_ID su Vercel.',
  );
  err.status = 403;
  throw err;
}
