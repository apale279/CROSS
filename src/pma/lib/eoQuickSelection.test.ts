import { describe, expect, it } from 'vitest'
import { mergeEoQuickColumnSelection } from './eoQuickSelection'

const LABELS = ['NELLA NORMA', 'CPSS POSITIVA', 'AGITAZIONE', 'CONFUSIONE'] as const

describe('mergeEoQuickColumnSelection', () => {
  it('preserva voci aggiunte da altri operatori mentre il modal era aperto', () => {
    const merged = mergeEoQuickColumnSelection(
      ['CPSS POSITIVA'],
      [],
      ['AGITAZIONE'],
      LABELS,
    )
    expect(merged).toEqual(['CPSS POSITIVA', 'AGITAZIONE'])
  })

  it('applica rimozioni dell’operatore senza cancellare voci altrui', () => {
    const merged = mergeEoQuickColumnSelection(
      ['CPSS POSITIVA', 'AGITAZIONE', 'CONFUSIONE'],
      ['CPSS POSITIVA', 'AGITAZIONE'],
      ['AGITAZIONE'],
      LABELS,
    )
    expect(merged).toEqual(['AGITAZIONE', 'CONFUSIONE'])
  })

  it('reset esplicito a solo NELLA NORMA', () => {
    const merged = mergeEoQuickColumnSelection(
      ['CPSS POSITIVA', 'CONFUSIONE'],
      ['CPSS POSITIVA'],
      ['NELLA NORMA'],
      LABELS,
    )
    expect(merged).toEqual(['NELLA NORMA'])
  })
})
