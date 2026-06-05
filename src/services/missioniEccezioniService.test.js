import { describe, expect, it } from 'vitest';
import { missioniAperteSuMezzo, missioneBloccaMezzo } from '../lib/mezzoMissione';

describe('eccezioni missione — snapshot mezzo dopo annullamento', () => {
  it('libera il mezzo in memoria quando la missione passa ad ANNULLATA', () => {
    const allMissioni = [
      {
        _docId: 'mis-a',
        mezzo: 'BRAVO_1',
        aperta: true,
        stato: 'DIRETTO H',
        esitoMissione: 'REGOLARE',
      },
    ];
    const allMissioniNext = allMissioni.map((m) =>
      m._docId === 'mis-a' ? { ...m, aperta: false, stato: 'ANNULLATA' } : m,
    );

    expect(missioniAperteSuMezzo(allMissioni, 'BRAVO_1').length).toBe(1);
    expect(missioneBloccaMezzo(allMissioni[0])).toBe(true);

    expect(missioniAperteSuMezzo(allMissioniNext, 'BRAVO_1')).toEqual([]);
  });
});
