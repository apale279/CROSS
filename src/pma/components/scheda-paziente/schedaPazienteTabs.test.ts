import { describe, expect, it } from 'vitest'
import {
  filterPmaShellTabsByRank,
  pmaShellTabsFor,
  PMA_SHELL_TABS,
} from './schedaPazienteTabs'

describe('pmaShellTabsFor triage', () => {
  it('include Triage tra Dati centrale e Cartella clinica', () => {
    const ids = pmaShellTabsFor(false).map((t) => t.id)
    expect(ids).toEqual(['anagrafica', 'dati_centrale', 'triage', 'cartella', 'dimissione'])
  })

  it('nasconde Triage senza pmaScheda', () => {
    const ids = pmaShellTabsFor(false, { hasPmaScheda: false }).map((t) => t.id)
    expect(ids).not.toContain('triage')
    expect(ids).toEqual(['anagrafica', 'dati_centrale', 'cartella', 'dimissione'])
  })
})

describe('filterPmaShellTabsByRank triage', () => {
  it('Triage rank: tab Triage e Cartella visibili, stesse regole cartella', () => {
    const filtered = filterPmaShellTabsByRank(PMA_SHELL_TABS, 'Triage').map((t) => t.id)
    expect(filtered).toContain('triage')
    expect(filtered).toContain('cartella')
  })
})
