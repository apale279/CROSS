import { describe, expect, it } from 'vitest';
import { formatMissioneMezzoLabel } from './missioneDisplay';
import { mezziMissioniEventoOptions } from './pazienteRules';

describe('missioneDisplay', () => {
  it('formatMissioneMezzoLabel', () => {
    expect(formatMissioneMezzoLabel('M1', 'BRAVO_1')).toBe('M1_BRAVO_1');
  });
});

describe('mezziMissioniEventoOptions', () => {
  it('etichetta sempre M_idMissione_mezzo', () => {
    const opts = mezziMissioniEventoOptions(
      [
        { idMissione: 'M1', idUnivoco: 'u1', mezzo: 'BRAVO_1', aperta: true, eventoCorrelato: 'E1' },
        { idMissione: 'M2', idUnivoco: 'u2', mezzo: 'BRAVO_1', aperta: true, eventoCorrelato: 'E1' },
      ],
      { idEvento: 'E1' },
    );
    expect(opts.map((o) => o.label)).toEqual(['M1_BRAVO_1', 'M2_BRAVO_1']);
  });
});
