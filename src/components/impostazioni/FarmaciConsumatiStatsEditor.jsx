import { useCallback, useEffect, useState } from 'react'
import { FARMACO_VIA_LABEL } from '@pma/types/cartellaClinica'
import {
  dedupeConsumatiByNome,
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '@pma/types/farmaciConsumatiStats'
import { btnSecondary } from '../ui/FormField'

function dosaggiToText(dosaggi) {
  return (dosaggi ?? []).join('; ')
}

export function FarmaciConsumatiStatsEditor({
  value,
  onChange,
  disabled = false,
  onClearRemote,
}) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    setRows(parseFarmaciConsumatiFromFirestore(value))
  }, [value])

  const commit = useCallback(
    (nextRows) => {
      const normalized = dedupeConsumatiByNome(nextRows)
      setRows(normalized)
      onChange(serializeFarmaciConsumati(normalized))
    },
    [onChange],
  )

  const clearAll = async () => {
    if (rows.length === 0) return
    if (!window.confirm('Azzerare tutte le statistiche di utilizzo?')) return
    try {
      if (onClearRemote) await onClearRemote()
      commit([])
    } catch (err) {
      window.alert(err?.message ?? 'Impossibile azzerare le statistiche su server.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase text-slate-700">Farmaci consumati</h4>
        <button
          type="button"
          className={btnSecondary}
          disabled={disabled || rows.length === 0}
          onClick={() => void clearAll()}
        >
          Azzera statistiche
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Aggiornato automaticamente quando si aggiunge un farmaco in cartella clinica. Stesso principio attivo:
        un’unica riga con il totale utilizzi.
      </p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
            <tr>
              <th className="p-2">Nome</th>
              <th className="p-2">Dosi usate</th>
              <th className="p-2">Via</th>
              <th className="p-2 w-24">N. utilizzi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-slate-500">
                  Nessun utilizzo registrato. I dati compaiono dopo somministrazioni in cartella clinica.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                  <td className="p-2 font-medium text-slate-900">{row.nome}</td>
                  <td className="p-2 text-xs text-slate-700">{dosaggiToText(row.dosaggi) || '—'}</td>
                  <td className="p-2 text-xs text-slate-700">{FARMACO_VIA_LABEL[row.via] ?? row.via}</td>
                  <td className="p-2 text-center font-semibold tabular-nums text-slate-900">{row.conteggio}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
