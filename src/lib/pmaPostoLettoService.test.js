import { describe, expect, it, vi } from 'vitest';
import { assignPazientePostoLetto, assegnaPostoLettoConPresaInCarico } from '../services/pmaPostoLettoService';
import { STATO_PZ_PMA } from './pmaModule';

vi.mock('../services/pazientiService', () => ({
  patchPaziente: vi.fn(),
}));

vi.mock('../services/pmaStatoService', () => ({
  prendiInCaricoPma: vi.fn(),
}));

import { patchPaziente } from '../services/pazientiService';
import { prendiInCaricoPma } from '../services/pmaStatoService';

describe('assegnaPostoLettoConPresaInCarico', () => {
  it('non propaga errore letto se presa in carico riuscita', async () => {
    prendiInCaricoPma.mockResolvedValue(undefined);
    patchPaziente.mockRejectedValue(new Error('rete'));

    const result = await assegnaPostoLettoConPresaInCarico(
      'm1',
      'p1',
      'bed-c0-r0',
      { statoPzPma: STATO_PZ_PMA.IN_ATTESA },
      [],
    );

    expect(prendiInCaricoPma).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.warning).toBeTruthy();
  });

  it('propaga errore se paziente già in carico e solo spostamento letto fallisce con throw occupato', async () => {
    prendiInCaricoPma.mockClear();
    patchPaziente.mockClear();

    const inCarico = [
      { _docId: 'altro', pmaPostoLettoId: 'bed-c0-r0' },
      { _docId: 'p1', pmaPostoLettoId: null },
    ];

    await expect(
      assignPazientePostoLetto('m1', 'p1', 'bed-c0-r0', inCarico),
    ).rejects.toThrow(/occupato/i);

    const result = await assegnaPostoLettoConPresaInCarico(
      'm1',
      'p1',
      'bed-c0-r0',
      { statoPzPma: STATO_PZ_PMA.IN_CARICO },
      inCarico,
    );

    expect(prendiInCaricoPma).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/occupato/i);
  });
});
