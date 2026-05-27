import { Trash2 } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';
import { btnSecondary } from '../ui/FormField';
import { MsbValutazioneForm } from './MsbValutazioneForm';
import { MsaValutazioneForm } from './MsaValutazioneForm';

/**
 * Tab dedicato alle valutazioni MSB o MSA nella scheda paziente.
 */
export function ValutazioniSoccorsoTab({
  tipo,
  valutazioniList,
  schedaSolaVisione,
  mezziEvento,
  onAdd,
  onRemove,
  onPatchMsb,
  onPatchMsa,
  onPatchMsaCreatoIl,
}) {
  const list = valutazioniList.filter((v) => v.tipo === tipo);
  const isMsa = tipo === 'MSA';
  const borderClass = isMsa ? 'border-violet-200/80 bg-violet-50/30' : 'border-teal-200/80 bg-teal-50/30';
  const badgeClass = isMsa
    ? 'bg-violet-200 text-violet-900'
    : 'bg-teal-200 text-teal-900';

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-slate-600">
          Valutazioni {tipo}
          {list.length > 0 ? ` (${list.length})` : ''}
        </p>
        {!schedaSolaVisione && (
          <button
            type="button"
            className={`${btnSecondary} px-2 py-1 text-xs font-semibold`}
            onClick={() => onAdd(tipo)}
          >
            + Valutazione {tipo}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nessuna valutazione {tipo}.{' '}
          {!schedaSolaVisione && (
            <button
              type="button"
              className="font-semibold text-sky-700 underline hover:text-sky-900"
              onClick={() => onAdd(tipo)}
            >
              Aggiungi valutazione {tipo}
            </button>
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.id} className={`rounded-lg border p-3 ${borderClass}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}
                >
                  Valutazione {tipo}
                </span>
                <div className="flex items-center gap-2">
                  {v.creatoIl && (
                    <span className="text-[10px] text-slate-500">
                      {formatTimestamp(v.creatoIl)}
                    </span>
                  )}
                  {!schedaSolaVisione && (
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-700"
                      title="Rimuovi valutazione"
                      onClick={() => onRemove(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {isMsa ? (
                <MsaValutazioneForm
                  valuationId={v.id}
                  msaDetails={v.msaDetails}
                  creatoIl={v.creatoIl}
                  mezziEventoSigle={mezziEvento}
                  onPatchDetails={(partial) => onPatchMsa(v.id, partial)}
                  onPatchCreatoIl={(creatoIl) => onPatchMsaCreatoIl(v.id, creatoIl)}
                />
              ) : (
                <MsbValutazioneForm
                  valuationId={v.id}
                  msbDetails={v.msbDetails}
                  mezziEventoSigle={mezziEvento}
                  onPatch={(partial) => onPatchMsb(v.id, partial)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
