import { describe, expect, it } from 'vitest';
import {
  intersectSelectionWithCatalog,
  normalizeStringNameArray,
  normalizeValutazioniMsbMsaImpostazioni,
} from './valutazioneMsbMsaLists';

describe('normalizeStringNameArray', () => {
  it('deduplica case-insensitive preservando ordine', () => {
    expect(normalizeStringNameArray([' A ', 'a', 'B'])).toEqual(['A', 'B']);
  });
});

describe('intersectSelectionWithCatalog', () => {
  it('ordina come catalogo', () => {
    expect(intersectSelectionWithCatalog(['X', 'Y', 'Z'], ['Z', 'X'])).toEqual(['X', 'Z']);
  });
});

describe('normalizeValutazioniMsbMsaImpostazioni', () => {
  it('include presidi e prestazioni', () => {
    expect(
      normalizeValutazioniMsbMsaImpostazioni({
        msbMsaPresidi: ['Collare'],
        prestazioniMsb: ['ECG'],
        prestazioniMsa: ['Monitor'],
      }),
    ).toMatchObject({
      msbMsaPresidi: ['Collare'],
      prestazioniMsb: ['ECG'],
      prestazioniMsa: ['Monitor'],
    });
  });
});
