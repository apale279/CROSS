import { describe, expect, it } from 'vitest';
import { displayNomePazientePma } from './pmaDisplayName';

describe('displayNomePazientePma', () => {
  it('mostra cognome nome', () => {
    expect(displayNomePazientePma({ cognome: 'Rossi', nome: 'Mario' })).toBe('Rossi Mario');
  });

  it('aggiunge pettorale se presente', () => {
    expect(
      displayNomePazientePma({ cognome: 'Rossi', nome: 'Mario', pettorale: 42 }),
    ).toBe('Rossi Mario (Pett. 42)');
  });

  it('mostra solo pettorale se manca anagrafica', () => {
    expect(displayNomePazientePma({ pettorale: 11 })).toBe('Pettorale 11');
  });

  it('fallback senza nome', () => {
    expect(displayNomePazientePma({})).toBe('Senza nome');
  });
});
