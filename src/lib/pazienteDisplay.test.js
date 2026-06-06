import { describe, expect, it } from 'vitest';
import { pazienteNomeDisplay, pazientePettoraleDisplay } from './pazienteDisplay';

describe('pazienteDisplay', () => {
  it('nome con cognome e nome', () => {
    expect(pazienteNomeDisplay({ cognome: 'Rossi', nome: 'Mario' })).toBe('Rossi Mario');
  });

  it('fallback senza nome', () => {
    expect(pazienteNomeDisplay({})).toBe('Senza nome');
  });

  it('pettorale solo se valorizzato', () => {
    expect(pazientePettoraleDisplay({ pettorale: 42 })).toBe(42);
    expect(pazientePettoraleDisplay({ pettorale: 0 })).toBe(0);
    expect(pazientePettoraleDisplay({ pettorale: null })).toBeNull();
    expect(pazientePettoraleDisplay({ pettorale: '' })).toBeNull();
    expect(pazientePettoraleDisplay({})).toBeNull();
  });
});
