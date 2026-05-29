import { describe, expect, it } from 'vitest';
import { TIPO_PZ } from './pmaModule';
import { conteggiCodiciMinoriPerPma } from './pmaDashboardCentrale';

describe('pmaDashboardCentrale', () => {
  it('conteggia codici minori aperti e chiusi per PMA', () => {
    const pazienti = [
      {
        pmaId: 'pma1',
        tipoPz: TIPO_PZ.CODICE_MINORE,
        codiceMinore: { oraFine: null },
      },
      {
        pmaId: 'pma1',
        tipoPz: TIPO_PZ.CODICE_MINORE,
        codiceMinore: { oraFine: { toMillis: () => 1 } },
      },
      {
        pmaId: 'pma2',
        tipoPz: TIPO_PZ.CODICE_MINORE,
        codiceMinore: {},
      },
    ];

    expect(conteggiCodiciMinoriPerPma(pazienti, 'pma1')).toEqual({
      aperti: 1,
      chiusi: 1,
      totale: 2,
    });
    expect(conteggiCodiciMinoriPerPma(pazienti, 'pma2')).toEqual({
      aperti: 1,
      chiusi: 0,
      totale: 1,
    });
  });
});
