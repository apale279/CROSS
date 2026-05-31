import { describe, expect, it } from 'vitest';
import { ESITO_TRASPORTA } from '../constants';
import { pazienteSuMissione, pazientiTrasportoPerMissione } from './pazientiTrasportoQuery';

describe('pazientiTrasportoQuery', () => {
  const missione = {
    idUnivoco: 'uid-m2',
    idMissione: 'M2',
    eventoCorrelato: 'E1',
    mezzo: 'BRAVO1',
  };

  it('pazienteSuMissione per missioneIdUnivoco', () => {
    expect(
      pazienteSuMissione(
        {
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m2',
          mezzo: 'BRAVO1',
        },
        missione,
      ),
    ).toBe(true);
    expect(
      pazienteSuMissione(
        {
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m1',
          mezzo: 'BRAVO1',
        },
        missione,
      ),
    ).toBe(false);
  });

  it('pazientiTrasportoPerMissione ignora pazienti di altra missione stesso mezzo', () => {
    const pazienti = [
      {
        esito: ESITO_TRASPORTA,
        eventoCorrelato: 'E1',
        missioneIdUnivoco: 'uid-m1',
        mezzo: 'BRAVO1',
      },
      {
        esito: ESITO_TRASPORTA,
        eventoCorrelato: 'E1',
        missioneIdUnivoco: 'uid-m2',
        mezzo: 'BRAVO1',
      },
    ];
    expect(pazientiTrasportoPerMissione(pazienti, missione)).toHaveLength(1);
    expect(pazientiTrasportoPerMissione(pazienti, missione)[0].missioneIdUnivoco).toBe('uid-m2');
  });

  it('pazienteSuMissione con solo missioneIdUnivoco (senza mezzo)', () => {
    expect(
      pazienteSuMissione(
        { eventoCorrelato: 'E1', missioneIdUnivoco: 'uid-m2' },
        missione,
      ),
    ).toBe(true);
  });
});
