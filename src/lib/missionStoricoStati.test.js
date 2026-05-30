import { describe, expect, it } from 'vitest';
import {
  buildStatoChangeFields,
  patchStoricoStatoAt,
  storicoStatoDotPath,
} from './missionStoricoStati.js';

describe('missionStoricoStati', () => {
  it('usa path puntati per nuovo stato', () => {
    const fields = buildStatoChangeFields({ storicoStati: { ALLERTARE: new Date() } }, 'IN POSTO');
    expect(fields.stato).toBe('IN POSTO');
    expect(fields.storicoStati).toBeUndefined();
    expect(storicoStatoDotPath('IN POSTO') in fields).toBe(true);
  });

  it('patchStoricoStatoAt non riscrive la mappa intera', () => {
    const patch = patchStoricoStatoAt({ storicoStati: {} }, 'PARTITO', new Date('2026-01-01T10:00:00'));
    expect(patch.storicoStati).toBeUndefined();
    expect(storicoStatoDotPath('PARTITO') in patch).toBe(true);
  });
});
