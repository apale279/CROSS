import { describe, expect, it } from 'vitest';
import {
  pazienteMatchesMissioneTrasporto,
  pazienteSuMissione,
} from './pazienteMissionMatch.js';

const missioneM1 = {
  idUnivoco: 'uid-m1',
  idMissione: 'M1',
  mezzo: 'BRAVO_1',
  eventoCorrelato: 'E1',
};

const missioneM2 = {
  idUnivoco: 'uid-m2',
  idMissione: 'M2',
  mezzo: 'BRAVO_1',
  eventoCorrelato: 'E1',
};

describe('api pazienteMissionMatch', () => {
  it('pazienteSuMissione per missioneIdUnivoco', () => {
    expect(
      pazienteSuMissione(
        { eventoCorrelato: 'E1', missioneIdUnivoco: 'uid-m1', esito: 'Trasporta' },
        missioneM1,
      ),
    ).toBe(true);
    expect(
      pazienteSuMissione(
        { eventoCorrelato: 'E1', missioneIdUnivoco: 'uid-m2', esito: 'Trasporta' },
        missioneM1,
      ),
    ).toBe(false);
  });

  it('pazienteMatchesMissioneTrasporto isola M1/M2 stesso mezzo', () => {
    const pM2 = {
      eventoCorrelato: 'E1',
      missioneIdUnivoco: 'uid-m2',
      idMissione: 'M2',
      mezzo: 'BRAVO_1',
      esito: 'Trasporta',
    };
    expect(pazienteMatchesMissioneTrasporto(pM2, missioneM1)).toBe(false);
    expect(pazienteMatchesMissioneTrasporto(pM2, missioneM2)).toBe(true);
  });

  it('pazienteSuMissione con idMissione senza mezzo', () => {
    expect(
      pazienteSuMissione(
        { eventoCorrelato: 'E1', idMissione: 'M2', missioneIdUnivoco: 'uid-m2' },
        missioneM2,
      ),
    ).toBe(true);
  });
});
