import { describe, expect, it } from 'vitest';
import {
  collectDiarioPmaAlertsAttivi,
  diarioPmaAlertKey,
  diarioPmaAlertSeq,
  isDiarioNotaPmaAlertAttivo,
} from './pmaDiarioAlert';

describe('pmaDiarioAlert', () => {
  it('attivo quando seq > chiuso', () => {
    expect(
      isDiarioNotaPmaAlertAttivo({
        importante: true,
        pmaAlertSeq: 2,
        pmaAlertChiusoSeq: 1,
      }),
    ).toBe(true);
    expect(
      isDiarioNotaPmaAlertAttivo({
        importante: true,
        pmaAlertSeq: 1,
        pmaAlertChiusoSeq: 1,
      }),
    ).toBe(false);
    expect(isDiarioNotaPmaAlertAttivo({ importante: false, pmaAlertSeq: 5 })).toBe(false);
  });

  it('chiave univoca per nota e sequenza', () => {
    expect(diarioPmaAlertKey('abc', 3)).toBe('diario_pma:abc:3');
    expect(diarioPmaAlertSeq({ pmaAlertSeq: 4 })).toBe(4);
  });

  it('collect ordina dal più recente', () => {
    const docs = [
      {
        id: 'a',
        data: () => ({
          importante: true,
          pmaAlertSeq: 1,
          pmaAlertChiusoSeq: 0,
          titolo: 'Vecchia',
          testo: 'x',
          pmaAlertInviatoIl: { toMillis: () => 100 },
        }),
      },
      {
        id: 'b',
        data: () => ({
          importante: true,
          pmaAlertSeq: 1,
          pmaAlertChiusoSeq: 0,
          titolo: 'Nuova',
          testo: 'y',
          pmaAlertInviatoIl: { toMillis: () => 200 },
        }),
      },
    ];
    const list = collectDiarioPmaAlertsAttivi(docs);
    expect(list).toHaveLength(2);
    expect(list[0].titolo).toBe('Nuova');
  });
});
