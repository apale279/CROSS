import { describe, expect, it } from 'vitest';
import { fieldsChiusuraMissioneSuEventoForzato } from './eventoChiusuraMissioni';
import { missioniAperteSuMezzo } from './mezzoMissione';

describe('flusso mezzo DISPONIBILE → chiudi missioni', () => {
  it('missioni aperte sul mezzo producono patch FINE MISSIONE', () => {
    const missioni = [
      {
        _docId: 'm1',
        idMissione: 'M1',
        mezzo: 'BRAVO1',
        aperta: true,
        stato: 'ALLERTARE',
        storicoStati: {},
      },
      {
        _docId: 'm2',
        idMissione: 'M2',
        mezzo: 'BRAVO1',
        aperta: true,
        stato: 'RIENTRO',
        storicoStati: {},
      },
    ];
    const aperte = missioniAperteSuMezzo(missioni, 'BRAVO1');
    expect(aperte).toHaveLength(2);
    expect(fieldsChiusuraMissioneSuEventoForzato(aperte[0]).stato).toBe('FINE MISSIONE');
    expect(fieldsChiusuraMissioneSuEventoForzato(aperte[1]).stato).toBe('FINE MISSIONE');
  });
});
