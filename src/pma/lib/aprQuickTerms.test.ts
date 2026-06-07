import { describe, expect, it } from 'vitest'
import {
  formatAprContent,
  normalizeAprContent,
  parseAprContent,
  toggleAprQuickTerm,
} from './aprQuickTerms'

describe('aprQuickTerms', () => {
  it('parse termini in prima riga e testo libero dopo riga vuota', () => {
    expect(parseAprContent('NEUROLOGICA, CARDIOVASCOLARE\n\nDiabete tipo 2')).toEqual({
      terms: ['NEUROLOGICA', 'CARDIOVASCOLARE'],
      freeText: 'Diabete tipo 2',
    })
  })

  it('non tratta testo libero con virgole come riga termini', () => {
    expect(parseAprContent('Ipertensione, diabete')).toEqual({
      terms: [],
      freeText: 'Ipertensione, diabete',
    })
  })

  it('toggle aggiunge/rimuove solo termini rapidi', () => {
    const base = 'Ipertensione nota'
    const withTerm = toggleAprQuickTerm(base, 'NEUROLOGICA')
    expect(withTerm).toBe('NEUROLOGICA\n\nIpertensione nota')
    const removed = toggleAprQuickTerm(withTerm, 'NEUROLOGICA')
    expect(removed).toBe('Ipertensione nota')
  })

  it('format mantiene ordine fisso', () => {
    expect(formatAprContent(['METABOLICA', 'NEUROLOGICA'], 'note')).toBe(
      'NEUROLOGICA, METABOLICA\n\nnote',
    )
  })

  it('normalize ripristina struttura', () => {
    expect(normalizeAprContent('METABOLICA, NEUROLOGICA\n\nAltro')).toBe(
      'NEUROLOGICA, METABOLICA\n\nAltro',
    )
  })
})
