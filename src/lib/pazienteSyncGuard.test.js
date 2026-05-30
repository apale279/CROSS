import { describe, expect, it } from 'vitest';
import {
  detectPmaCodiceColoreConflict,
  pmaCodiceColoreSyncBlocked,
} from './pazienteSyncGuard';

describe('pazienteSyncGuard', () => {
  it('blocca sync PMA se in carico', () => {
    expect(
      pmaCodiceColoreSyncBlocked({
        statoPzPma: 'in carico',
        pmaScheda: { codice_colore: 'rosso' },
      }),
    ).toBe(true);
  });

  it('rileva conflitto triage PMA diverso dal nuovo colore centrale', () => {
    const conflict = detectPmaCodiceColoreConflict(
      { pmaScheda: { codice_colore: 'rosso' }, statoPzPma: 'IN ARRIVO' },
      'Giallo',
    );
    expect(conflict?.currentPma).toBe('rosso');
    expect(conflict?.nextPma).toBe('giallo');
  });

  it('nessun conflitto se triage PMA già allineato', () => {
    expect(
      detectPmaCodiceColoreConflict(
        { pmaScheda: { codice_colore: 'giallo' }, statoPzPma: 'IN ARRIVO' },
        'Giallo',
      ),
    ).toBeNull();
  });
});
