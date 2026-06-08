import { describe, expect, it } from 'vitest';
import { STATO_PZ_PMA } from './pmaModule';
import {
  missioneStatoArrivatoOPsuccessivo,
  mostraEmojiArrivatoPma,
  mostraFrecciaDirettoHPma,
  pettoraleInlineSuRigaNomePma,
} from './pmaDeskPatientInfo';

describe('pmaDeskPatientInfo indicatori trasporto', () => {
  const pzCentraleInArrivo = {
    tipoPz: 'P',
    statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
  };

  it('missioneStatoArrivatoOPsuccessivo da ARRIVATO H in poi', () => {
    expect(missioneStatoArrivatoOPsuccessivo('DIRETTO H')).toBe(false);
    expect(missioneStatoArrivatoOPsuccessivo('ARRIVATO H')).toBe(true);
    expect(missioneStatoArrivatoOPsuccessivo('RIENTRO')).toBe(true);
    expect(missioneStatoArrivatoOPsuccessivo('FINE MISSIONE')).toBe(true);
  });

  it('freccia solo con DIRETTO H e paziente ancora in arrivo', () => {
    expect(
      mostraFrecciaDirettoHPma(pzCentraleInArrivo, { stato: 'DIRETTO H' }),
    ).toBe(true);
    expect(
      mostraFrecciaDirettoHPma(pzCentraleInArrivo, { stato: 'ARRIVATO H' }),
    ).toBe(false);
  });

  it('emoji ospedale con ARRIVATO H finché non in attesa/in carico', () => {
    expect(
      mostraEmojiArrivatoPma(pzCentraleInArrivo, { stato: 'ARRIVATO H' }),
    ).toBe(true);
    expect(
      mostraEmojiArrivatoPma(pzCentraleInArrivo, { stato: 'RIENTRO' }),
    ).toBe(true);
    expect(
      mostraEmojiArrivatoPma(
        { ...pzCentraleInArrivo, statoPzPma: STATO_PZ_PMA.IN_ATTESA },
        { stato: 'ARRIVATO H' },
      ),
    ).toBe(false);
    expect(
      mostraEmojiArrivatoPma(
        { ...pzCentraleInArrivo, statoPzPma: STATO_PZ_PMA.IN_CARICO },
        { stato: 'ARRIVATO H' },
      ),
    ).toBe(false);
  });
});

describe('pettoraleInlineSuRigaNomePma', () => {
  it('attivo per in arrivo, in attesa e centrale senza stato', () => {
    expect(pettoraleInlineSuRigaNomePma({ statoPzPma: STATO_PZ_PMA.IN_ARRIVO })).toBe(true);
    expect(pettoraleInlineSuRigaNomePma({ statoPzPma: STATO_PZ_PMA.IN_ATTESA })).toBe(true);
    expect(pettoraleInlineSuRigaNomePma({ tipoPz: 'P', statoPzPma: null })).toBe(true);
  });

  it('disattivo per in carico e dimessi', () => {
    expect(pettoraleInlineSuRigaNomePma({ statoPzPma: STATO_PZ_PMA.IN_CARICO })).toBe(false);
    expect(pettoraleInlineSuRigaNomePma({ statoPzPma: STATO_PZ_PMA.DIMESSO })).toBe(false);
  });
});
