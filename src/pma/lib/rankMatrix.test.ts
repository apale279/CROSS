import { describe, expect, it } from 'vitest'
import { effectivePmaUserRank, isPathAllowedForPmaOperator } from '../../lib/userAccess'
import {
  canChiudiDimissionePaziente,
  canInsertFarmaci,
  canWriteInvioPsFields,
  schedaTabCartellaAllows,
  schedaTabDimissioneAllows,
} from './rankMatrix'

describe('effectivePmaUserRank', () => {
  it('centrale senza pmaRank ottiene rank Centrale', () => {
    expect(effectivePmaUserRank({ accessType: 'CENTRALE' }, false)).toBe('Centrale')
  })

  it('superadmin ottiene rank Superadmin', () => {
    expect(effectivePmaUserRank(null, true)).toBe('Superadmin')
  })
})

describe('rankMatrix dimissione', () => {
  it('Infermiere e Soccorritore: lettura sì, modifica no', () => {
    for (const rank of ['Infermiere', 'Soccorritore'] as const) {
      expect(schedaTabDimissioneAllows(rank, 'READ')).toBe(true)
      expect(schedaTabDimissioneAllows(rank, 'UPDATE')).toBe(false)
    }
  })

  it('Medico può modificare dimissione', () => {
    expect(schedaTabDimissioneAllows('Medico', 'UPDATE')).toBe(true)
  })

  it('solo Medico e Superadmin possono dimettere il paziente', () => {
    expect(canChiudiDimissionePaziente('Medico')).toBe(true)
    expect(canChiudiDimissionePaziente('Superadmin')).toBe(true)
    expect(canChiudiDimissionePaziente('Centrale')).toBe(false)
    expect(canChiudiDimissionePaziente('Infermiere')).toBe(false)
    expect(canChiudiDimissionePaziente('Soccorritore')).toBe(false)
  })
})

describe('rankMatrix invio PS', () => {
  it('Medico può scrivere invio PS se la scheda è modificabile (anche dopo sblocco)', () => {
    expect(canWriteInvioPsFields('Medico', true)).toBe(true)
    expect(canWriteInvioPsFields('Medico', false)).toBe(false)
  })
})

describe('rankMatrix triage cartella', () => {
  it('Triage può leggere e aggiornare cartella (blocchi clinici limitati in UI)', () => {
    expect(schedaTabCartellaAllows('Triage', 'READ')).toBe(true)
    expect(schedaTabCartellaAllows('Triage', 'UPDATE')).toBe(true)
  })
})

describe('rankMatrix farmaci', () => {
  it('Soccorritore non può inserire farmaci', () => {
    expect(canInsertFarmaci('Soccorritore')).toBe(false)
  })

  it('Medico e Infermiere possono inserire farmaci', () => {
    expect(canInsertFarmaci('Medico')).toBe(true)
    expect(canInsertFarmaci('Infermiere')).toBe(true)
  })
})

describe('PMA operator navigation', () => {
  it('consente pma, pazienti, diario', () => {
    expect(isPathAllowedForPmaOperator('/pma/abc')).toBe(true)
    expect(isPathAllowedForPmaOperator('/pazienti')).toBe(true)
    expect(isPathAllowedForPmaOperator('/diario')).toBe(true)
  })

  it('blocca dashboard ed eventi', () => {
    expect(isPathAllowedForPmaOperator('/')).toBe(false)
    expect(isPathAllowedForPmaOperator('/eventi')).toBe(false)
    expect(isPathAllowedForPmaOperator('/missioni')).toBe(false)
    expect(isPathAllowedForPmaOperator('/impostazioni')).toBe(false)
  })
})
