import { useMemo, useState } from 'react'
import type { PmaFarmacoCatalogoEntry } from '@pma/types/farmaciCatalogo'
import {
  filterCatalogByNomePrefix,
  findCatalogEntryByNome,
} from '@pma/types/farmaciCatalogo'

const CUSTOM_DOSE = '__custom__'

type Props = {
  catalog: PmaFarmacoCatalogoEntry[]
  nome: string
  dose: string
  onNomeChange: (value: string) => void
  onDoseChange: (value: string) => void
  inputClassName?: string
  nomePlaceholder?: string
}

/**
 * Nome con suggerimenti dal catalogo; dose a tendina se nota, altrimenti testo libero.
 */
export function FarmacoNomeDoseFields({
  catalog,
  nome,
  dose,
  onNomeChange,
  onDoseChange,
  inputClassName = '',
  nomePlaceholder = 'Farmaco…',
}: Props) {
  const [nomeFocused, setNomeFocused] = useState(false)

  const matched = useMemo(() => findCatalogEntryByNome(catalog, nome), [catalog, nome])
  const suggestions = useMemo(
    () => filterCatalogByNomePrefix(catalog, nome, 10),
    [catalog, nome],
  )

  const doseOptions = matched?.dosaggi ?? []
  const doseSelectValue =
    dose && doseOptions.includes(dose) ? dose : doseOptions.length > 0 ? CUSTOM_DOSE : CUSTOM_DOSE

  return (
    <div className="space-y-3">
      <label className="relative block text-xs">
        <span className="font-semibold uppercase tracking-wider text-slate-500">Nome</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          onFocus={() => setNomeFocused(true)}
          onBlur={() => window.setTimeout(() => setNomeFocused(false), 150)}
          autoComplete="off"
          className={`${inputClassName} mt-1 min-h-[2.75rem] w-full text-base`}
          placeholder={nomePlaceholder}
        />
        {nomeFocused && suggestions.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {suggestions.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-violet-50"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onNomeChange(entry.nome)
                    if (entry.dosaggi.length === 1) onDoseChange(entry.dosaggi[0])
                    setNomeFocused(false)
                  }}
                >
                  {entry.nome}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>

      <label className="block text-xs">
        <span className="font-semibold uppercase tracking-wider text-slate-500">Dose</span>
        {doseOptions.length > 0 ? (
          <select
            value={doseSelectValue}
            onChange={(e) => {
              const v = e.target.value
              if (v === CUSTOM_DOSE) {
                if (doseOptions.includes(dose)) onDoseChange('')
                return
              }
              onDoseChange(v)
            }}
            className={`${inputClassName} mt-1 min-h-[2.75rem] w-full text-base`}
          >
            <option value={CUSTOM_DOSE}>— Altro / libero —</option>
            {doseOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : null}
        {doseOptions.length === 0 || doseSelectValue === CUSTOM_DOSE ? (
          <input
            type="text"
            value={dose}
            onChange={(e) => onDoseChange(e.target.value)}
            className={`${inputClassName} mt-1 min-h-[2.75rem] w-full text-base`}
            placeholder="Dose libera…"
          />
        ) : null}
      </label>
    </div>
  )
}
