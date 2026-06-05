import { describe, expect, it } from 'vitest';
import { mergeSchedaArrayById } from './pmaSchedaArrayMerge';
import { valuesEqual } from './pmaPatchSnapshot';

describe('appendPmaSchedaArrayRow (logica merge)', () => {
  it('secondo operatore aggiunge PV senza toccare righe del primo', () => {
    const server = [{ id: 'pv1', fc: 80, operatore_nome: 'A' }];
    const row = { id: 'pv2', fc: 90, operatore_nome: 'B' };
    const merged = mergeSchedaArrayById(server, [row]);
    expect(merged).toHaveLength(2);
    expect(valuesEqual(server, merged)).toBe(false);
  });

  it('secondo operatore aggiunge farmaco senza toccare righe del primo', () => {
    const server = [{ id: 'f1', nome: 'Adrenalina', dose: '1mg' }];
    const row = { id: 'f2', nome: 'Furosemide', dose: '20mg' };
    const merged = mergeSchedaArrayById(server, [row]);
    expect(merged).toHaveLength(2);
    expect(valuesEqual(server, merged)).toBe(false);
  });
});
