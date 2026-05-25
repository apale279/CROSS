import { useCallback, useEffect, useState } from 'react'
import { FARMACO_VIA_LABEL, FARMACO_VIE } from '@pma/types/cartellaClinica'
import {
  dedupeCatalogoByNome,
  newFarmacoCatalogoId,
  parseFarmaciCatalogoFromFirestore,
  serializeFarmaciCatalogo,
} from '@pma/types/farmaciCatalogo'
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

export function FarmaciConsumatiEditor({ value, onChange, disabled = false }) {
  const [rows, setRows] = useState([])

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
    commit([
      ...rows,
      { id: newFarmacoCatalogoId(), nome: '', dosaggi: [], via: 'EV' },
    ])
  }

  const importFromSeed = () => {
    if (
      rows.length > 0 &&
      !window.confirm('Sostituire l’elenco farmaci consumati con il catalogo CSV standard?')
    ) {
      return
    }
    commit(defaultFarmaciConsumatiCatalog())
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase text-slate-700">Farmaci consumati (catalogo PMA)</h4>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={disabled} onClick={importFromSeed}>
            Importa da CSV standard
          </button>
          <button type="button" className={btnSecondary} disabled={disabled} onClick={addRow}>
            + Farmaco
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600">
        Ogni farmaco ha un ID univoco (nascosto), nome, dosaggi separati da punto e virgola e via predefinita.
        In scheda paziente il nome viene suggerito e la dose scelta da menu.
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
            <tr>
              <th className="p-2">Nome</th>
              <th className="p-2">Dosaggi (;)</th>
              <th className="p-2">Via</th>
              <th className="p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-slate-500">
                  Nessun farmaco in elenco. Importa dal CSV o aggiungi manualmente.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                  <td className="p-2 align-top">
                    <input
                      type="hidden"
                      value={row.id}
                      readOnly
                      aria-hidden
                    />
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
