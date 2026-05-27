import { describe, expect, it } from 'vitest';
import {
  mezzoPatchFromStazionamentoPreset,
  resolveMezzoStazionamentoId,
} from './mezzoStazionamentoAssign';

describe('mezzoStazionamentoAssign', () => {
  it('assegna id e marca predefinito', () => {
    const patch = mezzoPatchFromStazionamentoPreset({
      id: 'st1',
      nome: 'LECCO',
      indirizzo: 'Via Roma 1',
      coordinate: { lat: 45, lng: 9 },
    });
    expect(patch.stazionamentoId).toBe('st1');
    expect(patch.stazionamentoPredefinito).toBe(true);
    expect(patch.stazionamento.indirizzo).toBe('Via Roma 1');
  });

  it('risolve id legacy da stazionamentoId', () => {
    const id = resolveMezzoStazionamentoId(
      { stazionamentoId: 'abc' },
      [{ id: 'abc', nome: 'X' }],
    );
    expect(id).toBe('abc');
  });
});
