import { describe, expect, it } from 'vitest';
import {
  IMPOSTAZIONI_NESTED_OBJECT_FIELDS,
  impostazioniMapFieldPath,
  isImpostazioniFieldSaveBlocked,
  isImpostazioniNestedObjectField,
  isImpostazioniTransactionalArrayField,
  readImpostazioniFieldForDisplay,
  readImpostazioniFieldRaw,
} from '../src/lib/impostazioniFieldAccess.js';

describe('impostazioniFieldAccess', () => {
  it('blocca campi map annidate e array transazionali', () => {
    expect(isImpostazioniNestedObjectField('pmaClinica')).toBe(true);
    expect(isImpostazioniTransactionalArrayField('stazionamenti')).toBe(true);
    expect(isImpostazioniFieldSaveBlocked('pma')).toBe(true);
    expect(isImpostazioniFieldSaveBlocked('listaOspedali')).toBe(false);
    expect(IMPOSTAZIONI_NESTED_OBJECT_FIELDS.has('dettagliPerTipoLuogo')).toBe(true);
  });

  it('read raw non applica default', () => {
    expect(readImpostazioniFieldRaw({}, 'tipiLuogo')).toBeUndefined();
    expect(readImpostazioniFieldRaw({ tipiLuogo: ['A'] }, 'tipiLuogo')).toEqual(['A']);
  });

  it('display applica default solo in lettura', () => {
    const tipi = readImpostazioniFieldForDisplay({}, 'tipiLuogo');
    expect(Array.isArray(tipi)).toBe(true);
    expect(tipi.length).toBeGreaterThan(0);
  });

  it('path puntato rifiuta chiavi con punto', () => {
    expect(() => impostazioniMapFieldPath('dettagliPerTipoLuogo', 'A.B')).toThrow(/\\./);
    expect(impostazioniMapFieldPath('dettagliPerTipoLuogo', 'UFFICIO')).toBe(
      'dettagliPerTipoLuogo.UFFICIO',
    );
  });
});
