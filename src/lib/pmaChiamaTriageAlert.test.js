import { describe, expect, it } from 'vitest';
import { STATO_PZ_PMA } from './pmaModule';
import {
  collectPmaChiamaTriageAlertsAttivi,
  isPazienteChiamaTriageAlertAttivo,
  pmaChiamaTriageAlertKey,
  pmaChiamaTriageSeq,
  titoloAlertPmaChiamaTriage,
} from './pmaChiamaTriageAlert';

describe('pmaChiamaTriageAlert', () => {
  it('attivo quando seq > chiuso', () => {
    expect(
      isPazienteChiamaTriageAlertAttivo({
        pmaChiamaTriageSeq: 2,
        pmaChiamaTriageChiusoSeq: 1,
      }),
    ).toBe(true);
    expect(
      isPazienteChiamaTriageAlertAttivo({
        pmaChiamaTriageSeq: 1,
        pmaChiamaTriageChiusoSeq: 1,
      }),
    ).toBe(false);
  });

  it('chiave univoca per paziente e sequenza', () => {
    expect(pmaChiamaTriageAlertKey('abc', 3)).toBe('chiama_triage:abc:3');
    expect(pmaChiamaTriageSeq({ pmaChiamaTriageSeq: 4 })).toBe(4);
  });

  it('collect filtra per PMA e stato in attesa', () => {
    const docs = [
      {
        id: 'a',
        data: () => ({
          statoPzPma: STATO_PZ_PMA.IN_ATTESA,
          pmaId: 'pma1',
          pmaChiamaTriageSeq: 1,
          pmaChiamaTriageChiusoSeq: 0,
          pmaChiamaTriageInviatoIl: { toMillis: () => 100 },
        }),
      },
      {
        id: 'b',
        data: () => ({
          statoPzPma: STATO_PZ_PMA.IN_ATTESA,
          pmaId: 'pma2',
          pmaChiamaTriageSeq: 1,
          pmaChiamaTriageChiusoSeq: 0,
          pmaChiamaTriageInviatoIl: { toMillis: () => 200 },
        }),
      },
      {
        id: 'c',
        data: () => ({
          statoPzPma: STATO_PZ_PMA.IN_CARICO,
          pmaId: 'pma1',
          pmaChiamaTriageSeq: 1,
          pmaChiamaTriageChiusoSeq: 0,
        }),
      },
    ];
    const list = collectPmaChiamaTriageAlertsAttivi(docs, 'pma1');
    expect(list).toHaveLength(1);
    expect(list[0].pazienteDocId).toBe('a');
  });

  it('titolo alert', () => {
    expect(titoloAlertPmaChiamaTriage()).toBe('Chiamata paziente');
  });
});
