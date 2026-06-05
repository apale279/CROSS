import { describe, expect, it } from 'vitest';
import { pazientiPerEvento } from './eventoLinks';
import { pazienteSuMissione } from './pazientiTrasportoQuery';
import { TIPO_PZ, STATO_PZ_PMA } from './pmaModule';
import {
  buildProvenienzaTrasportoCentrale,
  fieldsAnnullaInvioPma,
  fieldsMantieniPazienteAlPma,
  MISSION_PMA_CLOSE_MOTIVO,
  pazienteInviatoVersoPma,
  pazientiPmaSuMissione,
  pazientiPmaSuMissioni,
} from './missionPmaPatientClose';

const missione = {
  _docId: 'm1',
  idUnivoco: 'uid-m1',
  idMissione: 'M1',
  eventoCorrelato: 'E1',
  mezzo: 'BRAVO1',
};

const pzPmaCm = {
  _docId: 'p1',
  esito: 'Trasporta',
  missioneIdUnivoco: 'uid-m1',
  eventoCorrelato: 'E1',
  mezzo: 'BRAVO1',
  destinazionePmaId: 'pma1',
  statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
  percorsoCodiceMinore: true,
  tipoPz: TIPO_PZ.CODICE_MINORE,
  codiceMinore: { motivoArrivo: 'Caduta' },
};

describe('missionPmaPatientClose', () => {
  it('rileva paziente inviato verso PMA in arrivo', () => {
    expect(pazienteInviatoVersoPma(pzPmaCm)).toBe(true);
    expect(pazienteInviatoVersoPma({ ...pzPmaCm, statoPzPma: STATO_PZ_PMA.DIMESSO })).toBe(false);
  });

  it('trova pazienti PMA sulla missione', () => {
    expect(pazientiPmaSuMissione([pzPmaCm], missione)).toHaveLength(1);
    expect(
      pazientiPmaSuMissione([{ ...pzPmaCm, missioneIdUnivoco: 'altro' }], missione),
    ).toHaveLength(0);
  });

  it('deduplica su più missioni', () => {
    const m2 = { ...missione, _docId: 'm2', idMissione: 'M2' };
    expect(pazientiPmaSuMissioni([pzPmaCm], [missione, m2])).toHaveLength(1);
  });

  it('mantieni al PMA scollega evento missione mezzo e salva traccia', () => {
    const fields = fieldsMantieniPazienteAlPma(pzPmaCm, '[Trasporto centrale scollegato] test');
    expect(fields.eventoCorrelato).toBe('');
    expect(fields.missioneIdUnivoco).toBe('');
    expect(fields.mezzo).toBe('');
    expect(fields.destinazionePmaId).toBeUndefined();
    expect(fields['codiceMinore.provenienzaTrasporto']).toBe('[Trasporto centrale scollegato] test');
  });

  it('annulla invio PMA rimuove destinazione', () => {
    const fields = fieldsAnnullaInvioPma();
    expect(fields.destinazionePmaId).toBe('');
    expect(fields.statoPzPma).toBeDefined();
    expect(fields.percorsoCodiceMinore).toBeDefined();
  });

  it('dopo mantieni al PMA il paziente non è più su evento né missione', () => {
    const fields = fieldsMantieniPazienteAlPma(pzPmaCm, 'traccia');
    const updated = { ...pzPmaCm, ...fields };
    expect(pazienteSuMissione(updated, missione)).toBe(false);
    expect(pazientiPerEvento([updated], { idEvento: 'E1' })).toHaveLength(0);
    expect(updated.destinazionePmaId).toBe('pma1');
    expect(updated['codiceMinore.provenienzaTrasporto']).toBe('traccia');
  });

  it('buildProvenienzaTrasportoCentrale include evento missione mezzo', () => {
    const text = buildProvenienzaTrasportoCentrale({
      paziente: pzPmaCm,
      missione,
      evento: { idEvento: 'E1' },
      motivoChiusura: MISSION_PMA_CLOSE_MOTIVO.FINE_MISSIONE,
      quando: new Date('2026-05-28T10:00:00'),
    });
    expect(text).toContain('Evento E1');
    expect(text).toContain('Missione M1');
    expect(text).toContain('Mezzo BRAVO1');
    expect(text).toContain('FINE MISSIONE');
  });
});
