import { describe, expect, it } from 'vitest';
import {
  buildCodiceMinoreTrasportoNome,
  displayAnagraficaCodiceMinore,
  shouldAutoNomeCodiceMinoreTrasporto,
} from './codiceMinoreTrasportoNome.js';
import { TIPO_PZ } from './pmaModule.js';

describe('codiceMinoreTrasportoNome', () => {
  it('genera MEZZO_idPaziente', () => {
    expect(buildCodiceMinoreTrasportoNome({ mezzo: 'BRAVO_1', idPaziente: 'P42' })).toBe(
      'BRAVO_1_P42',
    );
  });

  it('display preferisce pettorale poi nome segnaposto', () => {
    expect(
      displayAnagraficaCodiceMinore({
        pettorale: 12,
        nome: 'Mario',
        cognome: 'Rossi',
      }),
    ).toBe('Rossi Mario (Pett. 12)');

    expect(
      displayAnagraficaCodiceMinore({
        mezzo: 'DELTA2',
        idPaziente: 'P7',
        nome: 'DELTA2_P7',
        tipoPz: TIPO_PZ.CODICE_MINORE,
        percorsoCodiceMinore: true,
      }),
    ).toBe('DELTA2_P7');
  });

  it('shouldAutoNome solo per trasporto centrale senza nome', () => {
    expect(
      shouldAutoNomeCodiceMinoreTrasporto({
        percorsoCodiceMinore: true,
        mezzo: 'A1',
        nome: '',
      }),
    ).toBe(true);
    expect(
      shouldAutoNomeCodiceMinoreTrasporto({
        tipoPz: TIPO_PZ.CODICE_MINORE,
        nome: 'Mario',
      }),
    ).toBe(false);
  });
});
