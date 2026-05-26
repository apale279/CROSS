import { describe, expect, it } from 'vitest';
import {
  fieldsChiusuraMissioneSuEventoForzato,
  missioneRichiedeChiusuraSuEventoForzato,
} from './eventoChiusuraMissioni';

describe('eventoChiusuraMissioni', () => {
  it('ANNULLATA aperta: solo chiude flag aperta, non passa a FINE MISSIONE', () => {
    const mis = { stato: 'ANNULLATA', aperta: true, _docId: 'x' };
    expect(missioneRichiedeChiusuraSuEventoForzato(mis)).toBe(true);
    expect(fieldsChiusuraMissioneSuEventoForzato(mis)).toEqual({ aperta: false });
  });

  it('ANNULLATA già chiusa: nessun aggiornamento', () => {
    const mis = { stato: 'ANNULLATA', aperta: false };
    expect(missioneRichiedeChiusuraSuEventoForzato(mis)).toBe(false);
  });

  it('missione attiva: passa a FINE MISSIONE', () => {
    const mis = { stato: 'IN POSTO', aperta: true, storicoStati: {} };
    const fields = fieldsChiusuraMissioneSuEventoForzato(mis);
    expect(fields.stato).toBe('FINE MISSIONE');
    expect(fields.aperta).toBe(false);
  });
});
