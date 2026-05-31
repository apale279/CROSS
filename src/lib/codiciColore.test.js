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
  it('restituisce il valore stored codiceColoreTrasporto', () => {
    expect(resolveCodiceColoreTrasporto({ codiceColoreTrasporto: 'Giallo' })).toBe('Giallo');
  });

  it('null se codiceColoreTrasporto assente', () => {
    expect(resolveCodiceColoreTrasporto({})).toBeNull();
    expect(resolveCodiceColoreTrasporto(null)).toBeNull();
  });

  it('null se valore non valido', () => {
    expect(resolveCodiceColoreTrasporto({ codiceColoreTrasporto: 'Viola' })).toBeNull();
  });
});
