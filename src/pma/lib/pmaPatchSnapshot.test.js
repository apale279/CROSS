import { describe, expect, it } from 'vitest';
import { buildGranularUpdatesFromSnapshot, valuesEqual } from './pmaPatchSnapshot';

describe('valuesEqual', () => {
  it('confronta array e primitivi', () => {
    expect(valuesEqual(['a'], ['a'])).toBe(true);
    expect(valuesEqual(['a'], ['b'])).toBe(false);
    expect(valuesEqual('x', 'x')).toBe(true);
  });
});

describe('buildGranularUpdatesFromSnapshot', () => {
  it('non scrive campi già uguali sul server', () => {
    const snap = {
      pmaScheda: { codice_colore: 'verde', farmaci: [] },
      statoPzPma: 'IN_CARICO',
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: { 'pmaScheda.codice_colore': 'verde' },
      eoMerges: [],
      arrayMerges: [],
    });
    expect(updates).toEqual({});
  });

  it('include solo path modificati', () => {
    const snap = { pmaScheda: { allergie: 'no' } };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: { 'pmaScheda.allergie': 'penicillina' },
      eoMerges: [],
      arrayMerges: [],
    });
    expect(updates).toEqual({ 'pmaScheda.allergie': 'penicillina' });
  });
});
