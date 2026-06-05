import { describe, expect, it } from 'vitest';
import {
  mergeLesioniByN,
  mergeSchedaArrayById,
  mergeStringSelectionArray,
} from './pmaSchedaArrayMerge.js';

describe('mergeSchedaArrayById', () => {
  it('unisce per id senza perdere righe server (snapshot stale)', () => {
    const server = [
      { id: 'a', nome: 'A', dose: '10mg' },
      { id: 'b', nome: 'B' },
      { id: 'c', nome: 'C' },
    ];
    const client = [{ id: 'a', nome: 'A-mod' }];
    expect(mergeSchedaArrayById(server, client)).toEqual([
      { id: 'a', nome: 'A-mod', dose: '10mg' },
      { id: 'b', nome: 'B' },
      { id: 'c', nome: 'C' },
    ]);
  });

  it('non cancella nome server se client stale ha campi vuoti', () => {
    const server = [{ id: 'a', nome: 'Paracetamolo', dose: '1g', via: 'OS' }];
    const client = [{ id: 'a', nome: '', dose: '', via: 'EV' }];
    expect(mergeSchedaArrayById(server, client)).toEqual([
      { id: 'a', nome: 'Paracetamolo', dose: '1g', via: 'EV' },
    ]);
  });

  it('rimuove solo con removeIds espliciti', () => {
    const server = [
      { id: 'a', nome: 'A' },
      { id: 'b', nome: 'B' },
    ];
    const client = [{ id: 'a', nome: 'A' }];
    expect(mergeSchedaArrayById(server, client, ['b'])).toEqual([{ id: 'a', nome: 'A' }]);
  });
});

describe('mergeStringSelectionArray', () => {
  it('non deseleziona voci server se client è sottoinsieme stale', () => {
    expect(mergeStringSelectionArray(['A', 'B', 'C'], ['A'])).toEqual(['A', 'B', 'C']);
  });

  it('rimuove solo etichette in removeLabels', () => {
    expect(mergeStringSelectionArray(['A', 'B', 'C'], ['A', 'D'], ['B'])).toEqual(['A', 'C', 'D']);
  });
});

describe('mergeLesioniByN', () => {
  it('mantiene lesioni server non presenti nel client stale', () => {
    const server = [
      { n: 1, descrizione: 'a' },
      { n: 3, descrizione: 'c' },
    ];
    const client = [{ n: 1, descrizione: 'a-mod' }];
    expect(mergeLesioniByN(server, client)).toEqual([
      { n: 1, descrizione: 'a-mod' },
      { n: 3, descrizione: 'c' },
    ]);
  });
});
