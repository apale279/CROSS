import { describe, expect, it } from 'vitest';
import { validateDimissioneBeforeClose } from './dimissioneValidate';

describe('validateDimissioneBeforeClose', () => {
  it('richiede esito, note e firma paziente', () => {
    const errors = validateDimissioneBeforeClose({});
    expect(errors.some((e) => e.includes('esito'))).toBe(true);
    expect(errors.some((e) => e.includes('note'))).toBe(true);
    expect(errors.some((e) => e.includes('firma'))).toBe(true);
  });

  it('accetta dimissione completa minima', () => {
    const errors = validateDimissioneBeforeClose({
      dimissione_esito: 'dimissione',
      dimissione_note: 'Note ok',
      firma_paziente_base64: 'data:image/png;base64,abc',
    });
    expect(errors).toEqual([]);
  });

  it('richiede ospedale per invio_ps', () => {
    const errors = validateDimissioneBeforeClose({
      dimissione_esito: 'invio_ps',
      dimissione_note: 'n',
      firma_paziente_base64: 'x',
    });
    expect(errors.some((e) => e.includes('ospedale'))).toBe(true);
  });
});
