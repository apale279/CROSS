import { describe, expect, it } from 'vitest';
import { AVANZAMENTO_PMA, resolveAvanzamentoPma } from './pmaAvanzamento';

describe('resolveAvanzamentoPma', () => {
  it('default DA VEDERE senza verifica allergie', () => {
    expect(resolveAvanzamentoPma({ pmaScheda: { allergie_verifica: null } })).toBe(
      AVANZAMENTO_PMA.DA_VEDERE,
    );
  });

  it('IN VISITA dopo risposta allergie', () => {
    expect(
      resolveAvanzamentoPma({ pmaScheda: { allergie_verifica: 'no', avanzamento_manuale: null } }),
    ).toBe(AVANZAMENTO_PMA.IN_VISITA);
  });

  it('manuale sovrascrive automatico', () => {
    expect(
      resolveAvanzamentoPma({
        pmaScheda: {
          allergie_verifica: 'no',
          avanzamento_manuale: AVANZAMENTO_PMA.ATTESA_DIMISSIONE,
        },
      }),
    ).toBe(AVANZAMENTO_PMA.ATTESA_DIMISSIONE);
  });
});
