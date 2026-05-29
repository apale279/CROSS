import { describe, expect, it } from 'vitest';
import {
  codiceColoreSanitarioFromValutazioni,
  resolveCodiceColoreTrasporto,
} from './codiciColore';

describe('codiceColoreSanitarioFromValutazioni', () => {
  it('restituisce il colore più grave tra MSB/MSA', () => {
    const colore = codiceColoreSanitarioFromValutazioni([
      { tipo: 'MSB', msbDetails: { codiceColore: 'Verde' } },
      { tipo: 'MSA', msaDetails: { codiceColore: 'Rosso' } },
    ]);
    expect(colore).toBe('Rosso');
  });

  it('null se nessuna valutazione con colore', () => {
    expect(codiceColoreSanitarioFromValutazioni([])).toBeNull();
  });
});

describe('resolveCodiceColoreTrasporto', () => {
  it('centrale: T da codiceColoreSanitario paziente, ignora T manuale missione', () => {
    const t = resolveCodiceColoreTrasporto(
      {
        codiceColoreTrasporto: 'Bianco',
        codiceColoreTrasportoManuale: true,
      },
      null,
      [{ codiceColoreSanitario: 'Giallo' }],
    );
    expect(t).toBe('Giallo');
  });

  it('PMA invio PS: usa codice missione se T non manuale', () => {
    const t = resolveCodiceColoreTrasporto(
      {
        tipoTrasporto: 'PMA_INVIO_PS',
        codiceColoreMissione: 'Rosso',
        codiceColoreTrasporto: 'Rosso',
      },
      { colore: 'Bianco' },
      [],
    );
    expect(t).toBe('Rosso');
  });
});
