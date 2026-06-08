import { describe, expect, it } from 'vitest';
import { buildGranularUpdatesFromSnapshot } from './pmaPatchSnapshot';

describe('triagePvCartellaBackup merge', () => {
  it('upsert riga triage in parametri_vitali con stesso id', () => {
    const snap = {
      pmaScheda: {
        parametri_vitali: [{ id: 'pv1', fc: 70, operatore_nome: 'A' }],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [
        {
          field: 'parametri_vitali',
          value: [{ id: 'pv1', fc: 88, gcs: 15, operatore_nome: 'Triage' }],
          removeIds: [],
        },
      ],
    });
    expect(updates['pmaScheda.parametri_vitali']).toHaveLength(1);
    expect(updates['pmaScheda.parametri_vitali'][0]).toMatchObject({
      id: 'pv1',
      fc: 88,
      gcs: 15,
      operatore_nome: 'Triage',
    });
  });

  it('append seconda riga triage senza toccare la prima', () => {
    const snap = {
      pmaScheda: {
        parametri_vitali: [{ id: 'pv1', fc: 70 }],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [
        {
          field: 'parametri_vitali',
          value: [{ id: 'pv2', fc: 90, operatore_nome: 'B' }],
          removeIds: [],
        },
      ],
    });
    expect(updates['pmaScheda.parametri_vitali']).toHaveLength(2);
    expect(updates['pmaScheda.parametri_vitali'].map((r) => r.id).sort()).toEqual(['pv1', 'pv2']);
  });
});
