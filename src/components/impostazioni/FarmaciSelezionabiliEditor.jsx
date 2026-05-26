import { useCallback, useEffect, useRef, useState } from 'react'
import { FARMACO_VIA_LABEL, FARMACO_VIE } from '@pma/types/cartellaClinica'
import {
  dedupeCatalogoByNome,
  newFarmacoCatalogoId,
  parseFarmaciCatalogoFromFirestore,
  serializeFarmaciCatalogo,
} from '@pma/types/farmaciCatalogo'
import { parseFarmaciCsvText } from '../../pma/lib/parseFarmaciCsv'
import { defaultFarmaciConsumatiCatalog } from '../../pma/lib/farmaciCatalogoSeed'
import { btnSecondary } from '../ui/FormField'

function dosaggiToText(dosaggi) {
  return (dosaggi ?? []).join('; ')
}

function textToDosaggi(text) {
  return String(text ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function FarmaciSelezionabiliEditor({ value, onChange, disabled = false }) {
  const [rows, setRows] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    const parsed = parseFarmaciCatalogoFromFirestore(value)
    setRows(parsed.length > 0 ? parsed : [])
  }, [value])

  const commit = useCallback(
    (nextRows) => {
      const normalized = dedupeCatalogoByNome(nextRows)
      setRows(normalized)
      onChange(serializeFarmaciCatalogo(normalized))
    },
    [onChange],
  )

  const updateRow = (id, patch) => {
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRow = (id) => {
    commit(rows.filter((r) => r.id !== id))
  }

  const addRow = () => {
    commit([...rows, { id: newFarmacoCatalogoId(), nome: '', dosaggi: [], via: 'EV' }])
  }

  const importFromSeed = () => {
    if (
      rows.length > 0 &&
      !window.confirm('Sostituire l’elenco farmaci selezionabili con il catalogo CSV standard?')
    ) {
      return
    }
    commit(defaultFarmaciConsumatiCatalog())
  }

  const onCsvFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseFarmaciCsvText(String(reader.result ?? ''))
      if (parsed.length === 0) {
        window.alert('Nessun farmaco valido nel file CSV.')
        return
      }
      if (
        rows.length > 0 &&
        !window.confirm(`Importare ${parsed.length} farmaci dal CSV (sostituisce l’elenco attuale)?`)
      ) {
        return
      }
      commit(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase text-slate-700">Farmaci (cartella clinica)</h4>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsvFile} />
          <button
            type="button"
            className={btnSecondary}
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            Importa .csv
          </button>
          <button type="button" className={btnSecondary} disabled={disabled} onClick={importFromSeed}>
            Catalogo standard
          </button>
          <button type="button" className={btnSecondary} disabled={disabled} onClick={addRow}>
            + Farmaco
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600">
        Elenco dei farmaci selezionabili in cartella clinica: nome, dose e via di somministrazione.
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
            <tr>
              <th className="p-2">Nome</th>
              <th className="p-2">Dose</th>
              <th className="p-2">Via</th>
              <th className="p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-slate-500">
                  Nessun farmaco. Importa un CSV o aggiungi manualmente.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                  <td className="p-2 align-top">
                    <input
                      type="text"
                      disabled={disabled}
                      value={row.nome}
                      onChange={(e) => updateRow(row.id, { nome: e.target.value })}
                      className="w-full min-w-[10rem] rounded border border-slate-300 px-2 py-1"
                      placeholder="Nome farmaco"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <textarea
                      disabled={disabled}
                      rows={2}
                      value={dosaggiToText(row.dosaggi)}
                      onChange={(e) => updateRow(row.id, { dosaggi: textToDosaggi(e.target.value) })}
                      className="w-full min-w-[14rem] rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                      placeholder="Dose 1; Dose 2"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <select
                      disabled={disabled}
                      value={row.via}
                      onChange={(e) => updateRow(row.id, { via: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1"
                    >
                      {FARMACO_VIE.map((via) => (
                        <option key={via} value={via}>
                          {FARMACO_VIA_LABEL[via]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      disabled={disabled}
                      className="text-xs font-semibold text-red-700"
                      onClick={() => removeRow(row.id)}
                    >
                      Rimuovi
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
