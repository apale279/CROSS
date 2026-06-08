import { describe, expect, it } from 'vitest';
import { nextStatoMissione, statiPercorsiAvanzamento } from './missionStati.js';

const SEQ = [
  'ALLERTARE',
  'ALLERTATO',
  'PARTITO',
  'IN POSTO',
  'DIRETTO H',
  'ARRIVATO H',
  'RIENTRO',
  'FINE MISSIONE',
  'ANNULLATA',
];

describe('missionStati', () => {
  it('nextStatoMissione avanza di uno', () => {
    expect(nextStatoMissione('IN POSTO', SEQ)).toBe('DIRETTO H');
  });

  it('statiPercorsiAvanzamento include intermedi su salto avanti', () => {
    expect(statiPercorsiAvanzamento('IN POSTO', 'ARRIVATO H', SEQ)).toEqual([
      'DIRETTO H',
      'ARRIVATO H',
    ]);
  });

  it('statiPercorsiAvanzamento vuoto se stesso stato', () => {
    expect(statiPercorsiAvanzamento('DIRETTO H', 'DIRETTO H', SEQ)).toEqual([]);
  });
});
