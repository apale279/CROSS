import { describe, expect, it } from 'vitest';
import { buildValutazioneGranularUpdates } from './valutazioneSoccorsoGranularUpdate';

describe('buildValutazioneGranularUpdates', () => {
  const current = {
    tipo: 'MSB',
    msbDetails: {
      app: 'nota',
      presidi: ['A'],
      lesioni: [['Ginocchio', 'DX', 'Abrasione', 3]],
      acc: { attivo: false, testimoniato: 'NO' },
    },
  };

  it('aggiorna solo msbDetails.presidi se solo quello è nel payload', () => {
    const updates = buildValutazioneGranularUpdates(current, {
      msbDetails: { presidi: ['A', 'B'] },
    });
    expect(Object.keys(updates)).toEqual(['msbDetails.presidi']);
    expect(updates['msbDetails.presidi']).toEqual(['A', 'B']);
  });

  it('non include campi msbDetails non presenti nel payload', () => {
    const updates = buildValutazioneGranularUpdates(current, {
      msbDetails: { app: 'nuova nota' },
    });
    expect(updates).toEqual({ 'msbDetails.app': 'nuova nota' });
  });

  it('diff per chiave in msaDetails.parametri', () => {
    const cur = {
      msaDetails: {
        parametri: { fr: null, fc: 80, gcs: null },
        presidi: [],
      },
    };
    const updates = buildValutazioneGranularUpdates(cur, {
      msaDetails: {
        parametri: { fr: null, fc: 80, gcs: 12 },
      },
    });
    expect(updates).toEqual({ 'msaDetails.parametri.gcs': 12 });
  });

  it('aggiorna lesioni con path puntato', () => {
    const updates = buildValutazioneGranularUpdates(current, {
      msbDetails: { lesioni: [] },
    });
    expect(Object.keys(updates)).toEqual(['msbDetails.lesioni']);
  });

  it('nessun update se valore invariato', () => {
    const updates = buildValutazioneGranularUpdates(current, {
      msbDetails: { presidi: ['A'] },
    });
    expect(updates).toEqual({});
  });

  it('salva riga lesione vuota appena aggiunta', () => {
    const updates = buildValutazioneGranularUpdates(
      { msbDetails: { lesioni: [] } },
      { msbDetails: { lesioni: [['', '', '', null]] } },
    );
    expect(updates['msbDetails.lesioni']).toEqual([['', '', '', null]]);
  });
});
