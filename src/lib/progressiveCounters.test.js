import { describe, expect, it } from 'vitest';
import {
  shouldSkipIdSeedFromCounterDoc,
  skipIdSeedField,
} from './progressiveCounters';

describe('progressiveCounters', () => {
  it('skipIdSeedField', () => {
    expect(skipIdSeedField('eventi')).toBe('eventiSkipIdSeed');
  });

  it('shouldSkipIdSeedFromCounterDoc', () => {
    expect(shouldSkipIdSeedFromCounterDoc(null, 'eventi')).toBe(false);
    expect(shouldSkipIdSeedFromCounterDoc({ eventi: 5 }, 'eventi')).toBe(false);
    expect(shouldSkipIdSeedFromCounterDoc({ eventiSkipIdSeed: true }, 'eventi')).toBe(true);
  });
});
