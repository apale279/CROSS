import { describe, expect, it } from 'vitest';
import { buildGranularUpdatesFromSnapshot, valuesEqual } from './pmaPatchSnapshot';

describe('valuesEqual', () => {
  it('confronta array e primitivi', () => {
    expect(valuesEqual(['a'], ['a'])).toBe(true);
    expect(valuesEqual(['a'], ['b'])).toBe(false);
    expect(valuesEqual('x', 'x')).toBe(true);
  });
});

describe('buildGranularUpdatesFromSnapshot', () => {
  it('non scrive campi già uguali sul server', () => {
    const snap = {
      pmaScheda: { codice_colore: 'verde', farmaci: [] },
      statoPzPma: 'IN_CARICO',
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: { 'pmaScheda.codice_colore': 'verde' },
      eoMerges: [],
      arrayMerges: [],
    });
    expect(updates).toEqual({});
  });

  it('include solo path modificati', () => {
    const snap = { pmaScheda: { allergie: 'no' } };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: { 'pmaScheda.allergie': 'penicillina' },
      eoMerges: [],
      arrayMerges: [],
    });
    expect(updates).toEqual({ 'pmaScheda.allergie': 'penicillina' });
  });

  it('unisce prestazioni_sel senza perdere voci server', () => {
    const snap = { pmaScheda: { prestazioni_sel: ['A', 'B'] } };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [{ field: 'prestazioni_sel', value: ['B', 'C'], removeIds: [] }],
    });
    expect(updates['pmaScheda.prestazioni_sel']).toEqual(['A', 'B', 'C']);
  });

  it('farmaci: snapshot stale non cancella righe server', () => {
    const snap = {
      pmaScheda: {
        farmaci: [
          { id: '1', nome: 'A' },
          { id: '2', nome: 'B' },
        ],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [{ field: 'farmaci', value: [{ id: '1', nome: 'A*' }], removeIds: [] }],
    });
    expect(updates['pmaScheda.farmaci']).toEqual([
      { id: '1', nome: 'A*' },
      { id: '2', nome: 'B' },
    ]);
  });

  it('farmaci: PC B aggiunge solo nuova riga (delta) senza perdere PC A', () => {
    const snap = {
      pmaScheda: {
        farmaci: [{ id: 'a', nome: 'Paracetamolo', dose: '1g' }],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [
        {
          field: 'farmaci',
          value: [{ id: 'b', nome: 'Ibuprofene', dose: '400mg', via: 'OS' }],
          removeIds: [],
        },
      ],
    });
    expect(updates['pmaScheda.farmaci']).toEqual([
      { id: 'a', nome: 'Paracetamolo', dose: '1g' },
      { id: 'b', nome: 'Ibuprofene', dose: '400mg', via: 'OS' },
    ]);
  });

  it('triage_parametri_vitali: append concorrente come parametri_vitali', () => {
    const snap = {
      pmaScheda: {
        triage_parametri_vitali: [{ id: 'tpv1', fc: 72, operatore_nome: 'Triage A' }],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [
        {
          field: 'triage_parametri_vitali',
          value: [{ id: 'tpv2', fc: 88, operatore_nome: 'Triage B' }],
          removeIds: [],
        },
      ],
    });
    expect(updates['pmaScheda.triage_parametri_vitali']).toHaveLength(2);
    expect(updates['pmaScheda.triage_parametri_vitali'].map((r) => r.id).sort()).toEqual([
      'tpv1',
      'tpv2',
    ]);
  });

  it('parametri_vitali: append concorrente da secondo operatore', () => {
    const snap = {
      pmaScheda: {
        parametri_vitali: [{ id: 'pv1', fc: 80, operatore_nome: 'Op A' }],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [
        {
          field: 'parametri_vitali',
          value: [{ id: 'pv2', fc: 90, operatore_nome: 'Op B' }],
          removeIds: [],
        },
      ],
    });
    expect(updates['pmaScheda.parametri_vitali']).toHaveLength(2);
    expect(updates['pmaScheda.parametri_vitali'].map((r) => r.id).sort()).toEqual(['pv1', 'pv2']);
  });

  it('rimozione solo con removeIds (nessun array client stale)', () => {
    const snap = {
      pmaScheda: {
        farmaci: [
          { id: '1', nome: 'A' },
          { id: '2', nome: 'B' },
        ],
      },
    };
    const updates = buildGranularUpdatesFromSnapshot(snap, {
      direct: {},
      eoMerges: [],
      arrayMerges: [{ field: 'farmaci', value: [], removeIds: ['2'] }],
    });
    expect(updates['pmaScheda.farmaci']).toEqual([{ id: '1', nome: 'A' }]);
  });
});
