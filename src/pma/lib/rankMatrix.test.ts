import { describe, expect, it } from 'vitest'
import { isPathAllowedForPmaOperator } from '../../lib/userAccess'
import { canInsertFarmaci, schedaTabDimissioneAllows } from './rankMatrix'

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
