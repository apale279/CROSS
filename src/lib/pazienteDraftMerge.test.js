import { describe, expect, it } from 'vitest';
import { mergePatientDraftFromServer, patientDocToDraftFields } from './pazienteDraftMerge';
import { fieldsPerEsito } from './pazienteRules';
import { ESITO_TRASPORTA } from '../constants';
import { STATO_PZ_PMA, TIPO_PZ } from './pmaModule';

describe('mergePatientDraftFromServer', () => {
  it('non sovrascrive notePaziente se dirty (digitazione locale)', () => {
    const prev = { notePaziente: 'Testo locale', nome: 'A' };
    const server = { notePaziente: 'Da server', nome: 'A' };
    const out = mergePatientDraftFromServer(prev, server, new Set(['notePaziente']));
    expect(out.notePaziente).toBe('Testo locale');
  });

  it('non sovrascrive campi segnati dirty', () => {
    const prev = { nome: 'Locale', cognome: 'X', esito: 'Trasporta', stato: 'TRASPORTO' };
    const server = {
      nome: 'Server',
      cognome: 'Y',
      esito: 'Trasporta',
      stato: 'ARRIVATO H',
      mezzo: 'BRAVO_1',
    };
    const dirty = new Set(['nome']);
    const out = mergePatientDraftFromServer(prev, server, dirty);
    expect(out.nome).toBe('Locale');
    expect(out.cognome).toBe('Y');
    expect(out.stato).toBe('ARRIVATO H');
  });

  it('non sovrascrive stato se dirty', () => {
    const prev = { stato: 'TRASPORTO', esito: ESITO_TRASPORTA };
    const server = { stato: 'ARRIVATO H', esito: ESITO_TRASPORTA };
    const out = mergePatientDraftFromServer(prev, server, new Set(['stato']));
    expect(out.stato).toBe('TRASPORTO');
  });

  it('allinea tipoPz e statoPzPma dal server se non dirty', () => {
    const prev = {
      tipoPz: '',
      statoPzPma: null,
      destinazionePmaId: '',
      esito: ESITO_TRASPORTA,
    };
    const server = {
      tipoPz: TIPO_PZ.CENTRALE,
      statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
      destinazionePmaId: 'pma1',
      pmaId: 'pma1',
      esito: ESITO_TRASPORTA,
    };
    const out = mergePatientDraftFromServer(prev, server, new Set());
    expect(out.tipoPz).toBe(TIPO_PZ.CENTRALE);
    expect(out.statoPzPma).toBe(STATO_PZ_PMA.IN_ARRIVO);
    expect(out.pmaId).toBe('pma1');
  });
});

describe('fieldsPerEsito clearTrasporto', () => {
  it('azzera anche percorsoCodiceMinore e tipoPz', () => {
    const fields = fieldsPerEsito('Dimesso', { clearTrasporto: true });
    expect(fields.percorsoCodiceMinore).toBe(false);
    expect(fields.tipoPz).toBe(TIPO_PZ.CENTRALE);
    expect(fields.destinazionePmaId).toBe('');
  });
});

describe('patientDocToDraftFields', () => {
  it('include campi PMA nel draft', () => {
    const d = patientDocToDraftFields({
      tipoPz: TIPO_PZ.CODICE_MINORE,
      statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
      destinazionePmaId: 'x',
      percorsoCodiceMinore: true,
    });
    expect(d.tipoPz).toBe(TIPO_PZ.CODICE_MINORE);
    expect(d.statoPzPma).toBe(STATO_PZ_PMA.IN_ARRIVO);
    expect(d.pmaId).toBe('x');
  });
});
