import { describe, expect, it } from 'vitest';
import { codiceColoreSanitarioFromValutazioni } from './codiciColore';

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
