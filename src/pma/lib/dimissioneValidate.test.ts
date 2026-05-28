import { describe, expect, it } from 'vitest';
import { validateDimissioneBeforeClose } from './dimissioneValidate';

describe('validateDimissioneBeforeClose', () => {
  it('richiede esito dimissione', () => {
    const errors = validateDimissioneBeforeClose({ medico_rif: 'Dr. Rossi' });
    expect(errors.some((e) => e.includes('esito'))).toBe(true);
  });

  it('richiede medico di riferimento', () => {
    const errors = validateDimissioneBeforeClose({ dimissione_esito: 'invio_ps' });
    expect(errors.some((e) => e.includes('medico'))).toBe(true);
  });

  it('accetta dimissione minima con esito e medico', () => {
    const errors = validateDimissioneBeforeClose({
      dimissione_esito: 'invio_ps',
      medico_rif: 'Dr. Bianchi',
    });
    expect(errors).toEqual([]);
  });

  it('non richiede ospedale PS in dimissione', () => {
    const errors = validateDimissioneBeforeClose({
      dimissione_esito: 'invio_ps',
      medico_rif: 'Dr. Bianchi',
    });
    expect(errors).toEqual([]);
  });

  it('non richiede dati affidatario in dimissione', () => {
    const errors = validateDimissioneBeforeClose({
      dimissione_esito: 'riaffidato',
      medico_rif: 'Dr. Bianchi',
    });
    expect(errors).toEqual([]);
  });
});
