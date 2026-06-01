import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('sandboxMode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_SANDBOX', 'true');
    vi.stubEnv('VITE_PRODUCTION_TENANT_ID', 'prod-tenant');
    vi.stubEnv('VITE_TENANT_ID', 'sandbox-tenant');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocca scritture sul tenant produzione in modalità sandbox', async () => {
    const { assertWritableTenant } = await import('./sandboxMode.js');
    expect(() => assertWritableTenant('prod-tenant')).toThrow(/bloccata/i);
    expect(() => assertWritableTenant('sandbox-tenant')).not.toThrow();
  });
});
