import { describe, expect, it } from 'vitest';
import { getMezzoDeleteBlockReason } from './mezzoDeleteGuard';

describe('getMezzoDeleteBlockReason', () => {
  it('consente eliminazione se restano solo missioni in RIENTRO', () => {
    const reason = getMezzoDeleteBlockReason('BRAVO_1', [
      { aperta: true, mezzo: 'BRAVO_1', stato: 'RIENTRO', idMissione: 'M10' },
    ]);
    expect(reason).toBeNull();
  });

  it('blocca se c’è missione attiva in IN POSTO', () => {
    const reason = getMezzoDeleteBlockReason('BRAVO1', [
      { aperta: true, mezzo: 'BRAVO_1', stato: 'IN POSTO', idMissione: 'M5' },
    ]);
    expect(reason).toContain('M5');
    expect(reason).toContain('IN POSTO');
  });
});
