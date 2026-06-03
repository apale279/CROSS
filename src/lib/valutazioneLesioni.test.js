import { describe, expect, it } from 'vitest';
import {
  emptyLesioneTuple,
  normalizeLesioni,
  normalizeLesioniImpostazioni,
} from './valutazioneLesioni';

describe('normalizeLesioni', () => {
  it('accetta tuple incluse righe vuote in modifica', () => {
    expect(
      normalizeLesioni([
        ['Ginocchio', 'DX', 'abrasione', 4],
        ['', '', '', null],
      ]),
    ).toEqual([
      ['Ginocchio', 'DX', 'abrasione', 4],
      ['', '', '', null],
    ]);
  });

  it('migra oggetti legacy in tuple', () => {
    expect(
      normalizeLesioni([
        { localizzazione: 'Braccio', lato: 'sn', tipologia: 'lacerazione', vas: 7 },
      ]),
    ).toEqual([['Braccio', 'SN', 'lacerazione', 7]]);
  });

  it('rispetta vasMax impostazioni', () => {
    expect(normalizeLesioni([['A', 'SN', 'B', 12]], 8)).toEqual([['A', 'SN', 'B', 8]]);
  });
});

describe('normalizeLesioniImpostazioni', () => {
  it('normalizza array di nomi', () => {
    expect(
      normalizeLesioniImpostazioni({
        lesioniLocalizzazioni: [' Ginocchio ', 'Ginocchio'],
        lesioniTipologie: ['Abrasione'],
        lesioniVasMax: 10,
      }),
    ).toMatchObject({
      lesioniLocalizzazioni: ['Ginocchio'],
      lesioniTipologie: ['Abrasione'],
      lesioniVasMax: 10,
    });
  });
});

describe('emptyLesioneTuple', () => {
  it('restituisce quattro campi vuoti', () => {
    expect(emptyLesioneTuple()).toEqual(['', '', '', null]);
  });
});
