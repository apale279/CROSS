import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { validateMissioneAperturaChange } from './missioneAperturaValidate.js';

describe('validateMissioneAperturaChange', () => {
  const now = new Date('2026-05-30T12:00:00');

  it('rifiuta data futura', () => {
    const r = validateMissioneAperturaChange({
      nextDate: new Date('2026-05-30T13:00:00'),
      missione: {},
      now,
    });
    expect(r.ok).toBe(false);
  });

  it('rifiuta apertura missione prima dell\'evento', () => {
    const r = validateMissioneAperturaChange({
      nextDate: new Date('2026-05-30T09:00:00'),
      missione: {},
      evento: { apertura: Timestamp.fromDate(new Date('2026-05-30T10:00:00')) },
      now,
    });
    expect(r.ok).toBe(false);
  });

  it('rifiuta apertura dopo uno stato in cronologia', () => {
    const r = validateMissioneAperturaChange({
      nextDate: new Date('2026-05-30T11:00:00'),
      missione: {
        storicoStati: {
          ALLERTARE: Timestamp.fromDate(new Date('2026-05-30T10:30:00')),
        },
      },
      now,
    });
    expect(r.ok).toBe(false);
  });

  it('accetta apertura coerente con evento e cronologia', () => {
    const r = validateMissioneAperturaChange({
      nextDate: new Date('2026-05-30T10:00:00'),
      missione: {
        storicoStati: {
          ALLERTARE: Timestamp.fromDate(new Date('2026-05-30T10:05:00')),
        },
        tratteMissione: [{ id: '1', descrizione: 'PS', quando: Timestamp.fromDate(new Date('2026-05-30T10:30:00')) }],
      },
      evento: { apertura: Timestamp.fromDate(new Date('2026-05-30T09:30:00')) },
      now,
    });
    expect(r.ok).toBe(true);
  });
});
