import { describe, expect, it, vi } from 'vitest';
import { newLocalId } from './ids';

describe('newLocalId', () => {
  it('usa fallback se crypto.randomUUID non è disponibile (HTTP LAN)', () => {
    const orig = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: orig?.getRandomValues?.bind(orig) });
    expect(newLocalId()).toMatch(/^id-\d+-[a-z0-9]+$/);
    vi.unstubAllGlobals();
  });

  it('genera id distinti', () => {
    const a = newLocalId();
    const b = newLocalId();
    expect(a).not.toBe(b);
  });
});
