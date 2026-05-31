import { describe, expect, it } from 'vitest';
import {
  isMezzoSelezionabilePerNuovaMissione,
  isMissioneAttiva,
  mezzoHaMissioneAttiva,
  missioneBloccaMezzo,
} from './mezzoMissione';

describe('mezzoMissione', () => {
  const mezzo = { sigla: 'BRAVO1', statoMezzo: 'Disponibile', operativo: true };

  it('esito INTERROTTA libera il mezzo pur con aperta true', () => {
    const mis = {
      aperta: true,
      stato: 'IN POSTO',
      mezzo: 'BRAVO1',
      esitoMissione: 'INTERROTTA',
    };
    expect(isMissioneAttiva(mis)).toBe(false);
    expect(missioneBloccaMezzo(mis)).toBe(false);
    expect(mezzoHaMissioneAttiva('BRAVO1', [mis])).toBe(false);
    expect(isMezzoSelezionabilePerNuovaMissione(mezzo, [mis])).toBe(true);
  });

  it('esito DIROTTATO libera il mezzo', () => {
    const mis = {
      aperta: true,
      stato: 'PARTITO',
      mezzo: 'BRAVO1',
      esitoMissione: 'DIROTTATO',
    };
    expect(missioneBloccaMezzo(mis)).toBe(false);
  });

  it('missione IN POSTO regolare blocca il mezzo', () => {
    const mis = {
      aperta: true,
      stato: 'IN POSTO',
      mezzo: 'BRAVO1',
      esitoMissione: 'REGOLARE',
    };
    expect(missioneBloccaMezzo(mis)).toBe(true);
    expect(isMezzoSelezionabilePerNuovaMissione(mezzo, [mis])).toBe(false);
  });
});
