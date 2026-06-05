import { describe, expect, it } from 'vitest';
import { buildGranularUpdatesFromSnapshot } from './pmaPatchSnapshot';
import { mergeSchedaArrayById } from './pmaSchedaArrayMerge';

/**
 * Stress test logico multi-operatore sulla cartella clinica:
 * simula patch delta come inviate da CartellaClinicaSection.
 */
describe('cartella clinica multi-operatore (stress logico)', () => {
  function applyPlan(snap, arrayMerges, direct = {}) {
    return buildGranularUpdatesFromSnapshot(snap, {
      direct,
      eoMerges: [],
      arrayMerges,
    });
  }

  function schedaFromSnap(snap, updates) {
    const scheda = { ...(snap.pmaScheda ?? {}) };
    for (const [path, value] of Object.entries(updates)) {
      if (path.startsWith('pmaScheda.')) {
        scheda[path.slice('pmaScheda.'.length)] = value;
      }
    }
    return scheda;
  }

  it('sequenza: Op A farmaco → Op B PV → Op A aggiorna farmaco → Op B secondo farmaco', () => {
    let snap = { pmaScheda: { farmaci: [], parametri_vitali: [] } };

    let u = applyPlan(snap, [
      {
        field: 'farmaci',
        value: [{ id: 'f1', nome: 'Adrenalina', dose: '1mg', via: 'IM' }],
        removeIds: [],
      },
    ]);
    snap = { pmaScheda: schedaFromSnap(snap, u) };

    u = applyPlan(snap, [
      {
        field: 'parametri_vitali',
        value: [{ id: 'pv1', fc: 110, operatore_nome: 'Infermiere B' }],
        removeIds: [],
      },
    ]);
    snap = { pmaScheda: schedaFromSnap(snap, u) };

    u = applyPlan(snap, [
      {
        field: 'farmaci',
        value: [{ id: 'f1', nome: 'Adrenalina', dose: '1mg', via: 'IM', inserito_da_nome: 'Medico A' }],
        removeIds: [],
      },
    ]);
    snap = { pmaScheda: schedaFromSnap(snap, u) };

    u = applyPlan(snap, [
      {
        field: 'farmaci',
        value: [{ id: 'f2', nome: 'Furosemide', dose: '20mg', via: 'EV' }],
        removeIds: [],
      },
    ]);
    snap = { pmaScheda: schedaFromSnap(snap, u) };

    expect(snap.pmaScheda.farmaci).toHaveLength(2);
    expect(snap.pmaScheda.parametri_vitali).toHaveLength(1);
    expect(snap.pmaScheda.farmaci.find((f) => f.id === 'f1')?.inserito_da_nome).toBe('Medico A');
  });

  it('client stale con riga vuota non cancella nome compilato da altro operatore', () => {
    const server = [{ id: 'f1', nome: 'Morphine', dose: '5mg', via: 'EV' }];
    const staleClient = [{ id: 'f1', nome: '', dose: '', via: 'EV' }];
    expect(mergeSchedaArrayById(server, staleClient)).toEqual(server);
  });

  it('rimozione farmaco non tocca altre righe', () => {
    const snap = {
      pmaScheda: {
        farmaci: [
          { id: '1', nome: 'A' },
          { id: '2', nome: 'B' },
        ],
      },
    };
    const u = applyPlan(snap, [{ field: 'farmaci', value: [], removeIds: ['1'] }]);
    expect(u['pmaScheda.farmaci']).toEqual([{ id: '2', nome: 'B' }]);
  });
});
