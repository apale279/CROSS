import { describe, expect, it } from 'vitest';
import {
  decodePmaDestinazioneSelectValue,
  encodePmaDestinazioneSelectValue,
  isPercorsoCodiceMinoreTrasporto,
  resolveDestinazioneTrasportoSelect,
} from './pmaDestinazioneTrasporto.js';
import { TIPO_PZ } from './pmaModule.js';

const impostazioni = {
  listaOspedali: ['Ospedale X'],
  pma: [{ id: 'pma1', nome: 'Tenda 1' }],
};

describe('pmaDestinazioneTrasporto', () => {
  it('codifica e decodifica PMA clinico vs codice minore', () => {
    expect(encodePmaDestinazioneSelectValue('pma1', { codiceMinore: false })).toBe(
      '__cross_pma__:pma1',
    );
    expect(encodePmaDestinazioneSelectValue('pma1', { codiceMinore: true })).toBe(
      '__cross_pma_cm__:pma1',
    );
    expect(decodePmaDestinazioneSelectValue('__cross_pma_cm__:pma1')).toEqual({
      pmaId: 'pma1',
      percorsoCodiceMinore: true,
    });
  });

  it('resolve select codice minore imposta percorsoCodiceMinore', () => {
    const dest = resolveDestinazioneTrasportoSelect('__cross_pma_cm__:pma1', impostazioni);
    expect(dest.destinazionePmaId).toBe('pma1');
    expect(dest.percorsoCodiceMinore).toBe(true);
    expect(dest.ospedaleDestinazione).toBe('Tenda 1');
  });

  it('isPercorsoCodiceMinoreTrasporto con flag o legame evento', () => {
    expect(isPercorsoCodiceMinoreTrasporto({ percorsoCodiceMinore: true })).toBe(true);
    expect(
      isPercorsoCodiceMinoreTrasporto({
        tipoPz: TIPO_PZ.CODICE_MINORE,
        eventoCorrelato: 'E1',
      }),
    ).toBe(true);
    expect(isPercorsoCodiceMinoreTrasporto({ tipoPz: TIPO_PZ.CODICE_MINORE })).toBe(false);
  });
});
