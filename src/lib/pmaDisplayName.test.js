import { describe, expect, it } from 'vitest';
import { displayNomePazientePma } from './pmaDisplayName';

describe('displayNomePazientePma', () => {
  it('mostra cognome nome', () => {
    expect(displayNomePazientePma({ cognome: 'Rossi', nome: 'Mario' })).toBe('Rossi Mario');
  });

  it('ignora pettorale nel testo (mostrato in badge)', () => {
    expect(
      displayNomePazientePma({ cognome: 'Rossi', nome: 'Mario', pettorale: 42 }),
    ).toBe('Rossi Mario');
  });

  it('senza anagrafica restituisce fallback', () => {
    expect(displayNomePazientePma({ pettorale: 11 })).toBe('Senza nome');
  });

  it('fallback senza nome', () => {
    expect(displayNomePazientePma({})).toBe('Senza nome');
  });
});
