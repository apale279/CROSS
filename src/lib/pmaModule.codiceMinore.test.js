import { describe, expect, it } from 'vitest';
import {
  TIPO_PZ,
  STATO_PZ_PMA,
  canConvertToCodiceMinore,
  isPazienteCodiceMinore,
} from './pmaModule';

describe('canConvertToCodiceMinore', () => {
  it('consente autopresentato in attesa', () => {
    expect(
      canConvertToCodiceMinore({
        tipoPz: TIPO_PZ.PMA,
        statoPzPma: STATO_PZ_PMA.IN_ATTESA,
        pmaId: 'pma1',
      }),
    ).toBe(true);
  });

  it('consente centrale in arrivo verso PMA', () => {
    expect(
      canConvertToCodiceMinore({
        tipoPz: TIPO_PZ.CENTRALE,
        statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
        destinazionePmaId: 'pma1',
      }),
    ).toBe(true);
  });

  it('rifiuta già codice minore', () => {
    expect(
      canConvertToCodiceMinore({
        tipoPz: TIPO_PZ.CODICE_MINORE,
        statoPzPma: STATO_PZ_PMA.IN_CARICO,
      }),
    ).toBe(false);
    expect(isPazienteCodiceMinore({ tipoPz: TIPO_PZ.CODICE_MINORE })).toBe(true);
  });

  it('rifiuta dimesso', () => {
    expect(
      canConvertToCodiceMinore({
        tipoPz: TIPO_PZ.PMA,
        statoPzPma: STATO_PZ_PMA.DIMESSO,
      }),
    ).toBe(false);
  });
});
