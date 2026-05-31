import { describe, expect, it } from 'vitest';
import {
  decodeMezzoMissioneSelect,
  encodeMezzoMissioneSelect,
  mezzoMissioneSelectValue,
} from './mezzoMissioneSelect';

describe('mezzoMissioneSelect', () => {
  const missioni = [
    { idUnivoco: 'uid-m1', idMissione: 'M1', mezzo: 'BRAVO1', aperta: true },
  ];

  it('option value e select value coincidono con una sola missione sul mezzo', () => {
    const optValue = encodeMezzoMissioneSelect('uid-m1', 'BRAVO1');
    const draft = { mezzo: 'BRAVO1', missioneIdUnivoco: 'uid-m1', idMissione: 'M1' };
    expect(mezzoMissioneSelectValue(draft, missioni)).toBe(optValue);
  });

  it('decodifica il valore selezionato', () => {
    const raw = encodeMezzoMissioneSelect('uid-m1', 'BRAVO1');
    const { mezzo, missione } = decodeMezzoMissioneSelect(raw, missioni);
    expect(mezzo).toBe('BRAVO1');
    expect(missione?.idMissione).toBe('M1');
  });

  it('risolve uid da idMissione se manca missioneIdUnivoco', () => {
    const draft = { mezzo: 'BRAVO1', idMissione: 'M1' };
    expect(mezzoMissioneSelectValue(draft, missioni)).toBe(
      encodeMezzoMissioneSelect('uid-m1', 'BRAVO1'),
    );
  });
});
