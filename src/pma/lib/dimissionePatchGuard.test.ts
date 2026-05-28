import { describe, expect, it } from 'vitest';
import { STATO_PZ_PMA } from '../../lib/pmaModule';
import { assertDimissionePatchAllowed, planClosesDimissione } from './dimissionePatchGuard';

describe('dimissionePatchGuard', () => {
  it('rileva chiusura dimissione', () => {
    expect(
      planClosesDimissione({ direct: { statoPzPma: STATO_PZ_PMA.DIMESSO } }),
    ).toBe(true);
  });

  it('blocca dimissione senza esito', () => {
    expect(() =>
      assertDimissionePatchAllowed(
        { pmaScheda: {}, ospedaleDestinazione: 'Osp' },
        { direct: { statoPzPma: STATO_PZ_PMA.DIMESSO } },
      ),
    ).toThrow(/esito/i);
  });

  it('accetta invio_ps senza ospedale se c\'è il medico', () => {
    expect(() =>
      assertDimissionePatchAllowed(
        {
          pmaScheda: { dimissione_esito: 'invio_ps', medico_rif: 'Dr. Verdi' },
        },
        { direct: { statoPzPma: STATO_PZ_PMA.DIMESSO } },
      ),
    ).not.toThrow();
  });
});
