import { describe, expect, it } from 'vitest';
import {
  assertPazientePatchGranular,
  flattenMezzoPatchFields,
} from './granularFirestorePatch.js';

describe('granularFirestorePatch', () => {
  it('blocca codiceMinore intero su patchPaziente', () => {
    expect(() => assertPazientePatchGranular({ codiceMinore: { motivoArrivo: 'x' } })).toThrow(
      /codiceMinore/,
    );
  });

  it('blocca pmaScheda intero su patchPaziente', () => {
    expect(() => assertPazientePatchGranular({ pmaScheda: { codice_colore: 'rosso' } })).toThrow(
      /pmaScheda/,
    );
  });

  it('espande equipaggio in path puntati', () => {
    const out = flattenMezzoPatchFields({
      equipaggio: {
        autista: { nome: 'A', cognome: 'B', telefono: '1' },
      },
      statoMezzo: 'Disponibile',
    });
    expect(out['equipaggio.autista.nome']).toBe('A');
    expect(out.statoMezzo).toBe('Disponibile');
    expect(out.equipaggio).toBeUndefined();
  });

  it('mantiene coordinate stazionamento come campo atomico', () => {
    const coord = { latitude: 1, longitude: 2 };
    const out = flattenMezzoPatchFields({
      stazionamento: { indirizzo: 'Via Roma', coordinate: coord },
    });
    expect(out['stazionamento.indirizzo']).toBe('Via Roma');
    expect(out['stazionamento.coordinate']).toEqual(coord);
  });
});
