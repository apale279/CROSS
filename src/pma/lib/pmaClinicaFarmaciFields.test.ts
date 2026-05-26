import { describe, expect, it } from 'vitest'
import { resolvePmaClinicaFarmaciFields } from './pmaClinicaFarmaciFields'
import {
  incrementFarmacoConsumato,
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '../types/farmaciConsumatiStats'

describe('resolvePmaClinicaFarmaciFields', () => {
  it('legge catalogo da farmaci e statistiche da farmaci_consumati', () => {
    const resolved = resolvePmaClinicaFarmaciFields({
      farmaci: [{ id: 'a', nome: 'Paracetamolo', dosaggi: ['500 mg'], via: 'OS' }],
      farmaci_consumati: [{ id: 'a', nome: 'Paracetamolo', conteggio: 2, dosaggi: ['500 mg'], via: 'OS' }],
    })
    expect(resolved.farmaci).toHaveLength(1)
    expect(resolved.farmaci[0].nome).toBe('Paracetamolo')
    expect(resolved.farmaci_consumati).toHaveLength(1)
    expect(resolved.farmaci_consumati[0].conteggio).toBe(2)
  })

  it('migra catalogo legacy da farmaci_consumati verso farmaci', () => {
    const resolved = resolvePmaClinicaFarmaciFields({
      farmaci: [],
      farmaci_consumati: [{ id: 'x', nome: 'Adrenalina', dosaggi: ['1 mg'], via: 'EV' }],
    })
    expect(resolved.farmaci).toHaveLength(1)
    expect(resolved.farmaci[0].nome).toBe('Adrenalina')
    expect(resolved.farmaci_consumati).toHaveLength(0)
  })
})

describe('farmaci_consumati aggregazione', () => {
  it('somma utilizzi per stesso nome', () => {
    let stats = parseFarmaciConsumatiFromFirestore([])
    stats = incrementFarmacoConsumato(stats, { nome: 'Paracetamolo', dose: '500 mg', via: 'OS' })
    stats = incrementFarmacoConsumato(stats, { nome: 'paracetamolo', dose: '1 g', via: 'OS' })
    const out = serializeFarmaciConsumati(stats)
    expect(out).toHaveLength(1)
    expect(out[0].conteggio).toBe(2)
    expect(out[0].dosaggi).toEqual(expect.arrayContaining(['500 mg', '1 g']))
  })

  it('ignora righe catalogo legacy senza conteggio', () => {
    const stats = parseFarmaciConsumatiFromFirestore([
      { id: 'c', nome: 'Atropina', dosaggi: ['0.5 mg'], via: 'EV' },
      { id: 's', nome: 'Paracetamolo', conteggio: 3, dosaggi: [], via: 'OS' },
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0].nome).toBe('Paracetamolo')
  })
})
