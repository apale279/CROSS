import { describe, expect, it } from 'vitest';
import {
  buildCounterResetPatch,
  emptyCounterSelection,
  emptyEntitySelection,
  selectedCounterKeys,
  selectedEntityKeys,
} from './opsDangerZone';

describe('opsDangerZone selection', () => {
  it('richiede almeno un\'entità', () => {
    expect(selectedEntityKeys(emptyEntitySelection())).toEqual([]);
    expect(
      selectedEntityKeys({ eventi: true, missioni: false, mezzi: false, pazienti: false, note: false }),
    ).toEqual(['eventi']);
  });

  it('costruisce patch contatori a zero', () => {
    expect(buildCounterResetPatch(emptyCounterSelection())).toEqual({});
    expect(
      buildCounterResetPatch({ eventi: true, missioni: false, pazienti: true }),
    ).toEqual({ eventi: 0, eventiSkipIdSeed: true, pazienti: 0, pazientiSkipIdSeed: true });
    expect(selectedCounterKeys({ eventi: false, missioni: true, pazienti: false })).toEqual([
      'missioni',
    ]);
  });
});
