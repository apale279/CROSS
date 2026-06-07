import { describe, expect, it } from 'vitest';
import {
  buildPostiLetto,
  defaultPostoLettoLabel,
  defaultPostoLettoNumero,
  partitionInCaricoPerPostiLetto,
  postoLettoId,
} from './pmaPostiLetto';

describe('pmaPostiLetto', () => {
  it('genera numeri per riga sinistra-destra (1,2 poi 3,4)', () => {
    expect(defaultPostoLettoNumero(0, 0, 2)).toBe(1);
    expect(defaultPostoLettoNumero(1, 0, 2)).toBe(2);
    expect(defaultPostoLettoNumero(0, 1, 2)).toBe(3);
    expect(defaultPostoLettoNumero(1, 1, 2)).toBe(4);
  });

  it('etichetta default LETTO N°', () => {
    expect(defaultPostoLettoLabel(0, 0, 2)).toBe('LETTO N°1');
    expect(defaultPostoLettoLabel(1, 0, 2)).toBe('LETTO N°2');
  });

  it('buildPostiLetto ordina per riga e rispetta label personalizzate', () => {
    const beds = buildPostiLetto({
      grigliaPostiLetto: { righe: 2, colonne: 2 },
      postiLettoLabels: { [postoLettoId(0, 0)]: 'Triage A' },
    });
    expect(beds).toHaveLength(4);
    expect(beds[0].label).toBe('Triage A');
    expect(beds[1].label).toBe('LETTO N°2');
    expect(beds[2].label).toBe('LETTO N°3');
  });

  it('partition mette senza letto i pazienti non assegnati', () => {
    const posti = buildPostiLetto({ grigliaPostiLetto: { righe: 1, colonne: 2 } });
    const p1 = { _docId: 'p1', pmaPostoLettoId: posti[0].id };
    const p2 = { _docId: 'p2' };
    const { byBed, senzaLetto } = partitionInCaricoPerPostiLetto([p1, p2], posti);
    expect(byBed.get(posti[0].id)?._docId).toBe('p1');
    expect(senzaLetto.map((p) => p._docId)).toEqual(['p2']);
  });
});
