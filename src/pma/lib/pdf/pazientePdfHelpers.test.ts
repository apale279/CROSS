import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { defaultPdfFilename, formatAperturaSchedaForFilename, sanitizeFilePart } from './pazientePdfHelpers'
import type { Paziente } from '@pma/types/paziente'

describe('pazientePdfHelpers', () => {
  it('sanitizeFilePart normalizza caratteri non sicuri', () => {
    expect(sanitizeFilePart('  A/B:C  ')).toBe('A_B_C')
  })

  it('formatAperturaSchedaForFilename produce YYYYMMDD_HH-mm locale', () => {
    const ts = Timestamp.fromDate(new Date(2024, 5, 12, 14, 7, 0))
    expect(formatAperturaSchedaForFilename(ts)).toBe('20240612_14-07')
  })

  it('defaultPdfFilename: data apertura + nome + cognome + id progressivo', () => {
    const p = {
      id: 'x',
      id_paziente_visibile: 'PMA-001',
      cognome: 'Rossi',
      nome: 'Mario',
      apertura_scheda: Timestamp.fromDate(new Date(2024, 5, 12, 14, 7, 0)),
    } as Paziente
    expect(defaultPdfFilename(p)).toBe('20240612_14-07_Mario_Rossi_PMA-001.pdf')
  })
})
