import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { defaultFarmaciConsumatiCatalog } from '@pma/lib/farmaciCatalogoSeed';
import { usePmaClinicaListe } from '../../pma/hooks/usePmaClinicaListe';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal';
import { normalizeMsaDetails } from '../../lib/msaValutazione';
import { AccValutazioneBlock } from './AccValutazioneBlock';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { BlurCommitTextarea } from '../ui/BlurCommitTextarea';
import { FormField, btnPrimary, inputClass, selectClass } from '../ui/FormField';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';
import { MsaParametriVitaliFields } from './MsaParametriVitaliFields';
import { ValutazioneLesioniTable } from './ValutazioneLesioniTable';
import { ValutazioneImpostazioniMultiselect } from './ValutazioneImpostazioniMultiselect';
import { FarmacoNomeSuggestInput } from './FarmacoNomeSuggestInput';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  listaMsbMsaPresidi,
  listaPrestazioniMsa,
  intersectSelectionWithCatalog,
} from '../../lib/valutazioneMsbMsaLists';

export function MsaValutazioneForm({
  msaDetails,
  creatoIl,
  mezziEventoSigle,
  onPatchDetails,
  onPatchCreatoIl,
}) {
  const { impostazioni } = useImpostazioni();
  const { farmaciCatalogo: farmaciCatalogoRaw } = usePmaClinicaListe();
  const farmaciCatalogo = useMemo(
    () =>
      farmaciCatalogoRaw.length > 0 ? farmaciCatalogoRaw : defaultFarmaciConsumatiCatalog(),
    [farmaciCatalogoRaw],
  );
  const catalogPresidi = listaMsbMsaPresidi(impostazioni);
  const catalogPrestazioniMsa = listaPrestazioniMsa(impostazioni);
  const d = normalizeMsaDetails(msaDetails);

  const patchFarmaci = (next) => onPatchDetails({ farmaci: next });

  return (
    <div className="space-y-3 border-l-2 border-violet-400 pl-3">
      <ValutazioneMezzoButtons
        mezziSigle={mezziEventoSigle}
        value={d.mezzoMsa ?? ''}
        onChange={(mezzoMsa) => onPatchDetails({ mezzoMsa })}
      />

      <FormField label="Data e ora valutazione">
        <input
          type="datetime-local"
          className={inputClass}
          value={toDatetimeLocalValue(creatoIl ?? Timestamp.now())}
          onChange={(e) => {
            const date = fromDatetimeLocalValue(e.target.value);
            if (date) onPatchCreatoIl(Timestamp.fromDate(date));
          }}
        />
      </FormField>

      <AccValutazioneBlock
        acc={d.acc}
        onPatchAcc={(accPartial) => onPatchDetails({ acc: accPartial })}
      />

      <MsaParametriVitaliFields
        parametri={d.parametri}
        onPatch={(partial) =>
          onPatchDetails({
            parametri: { ...normalizeMsaDetails(d).parametri, ...partial },
          })
        }
      />

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-slate-700">Farmaci</p>
          <button
            type="button"
            className={`${btnPrimary} inline-flex h-9 items-center justify-center px-3 text-xs`}
            onClick={() => patchFarmaci([...(d.farmaci ?? []), ''])}
          >
            Aggiungi farmaco
          </button>
        </div>
        <ul className="space-y-2">
          {(d.farmaci ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">
              Nessun farmaco registrato. Usa «Aggiungi farmaco» per inserire una riga.
            </li>
          ) : (
            (d.farmaci ?? []).map((farmaco, idx) => (
              <li key={idx} className="flex gap-2">
                <FarmacoNomeSuggestInput
                  catalog={farmaciCatalogo}
                  value={farmaco}
                  inputClassName={inputClass}
                  placeholder="Nome / dose / via…"
                  onChange={(value) => {
                    const next = [...d.farmaci];
                    next[idx] = value;
                    patchFarmaci(next);
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded p-2 text-slate-400 hover:bg-red-100 hover:text-red-700"
                  title="Rimuovi"
                  onClick={() => patchFarmaci(d.farmaci.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <ValutazioneLesioniTable
        lesioni={d.lesioni}
        onPatchLesioni={(next) => onPatchDetails({ lesioni: next })}
      />

      <ValutazioneImpostazioniMultiselect
        label="Presidi"
        options={catalogPresidi}
        selected={d.presidi}
        onChange={(next) =>
          onPatchDetails({
            presidi: intersectSelectionWithCatalog(catalogPresidi, next),
          })
        }
      />

      <ValutazioneImpostazioniMultiselect
        label="Prestazioni MSA"
        options={catalogPrestazioniMsa}
        selected={d.prestazioniMsa}
        onChange={(next) =>
          onPatchDetails({
            prestazioniMsa: intersectSelectionWithCatalog(catalogPrestazioniMsa, next),
          })
        }
      />

      <FormField label="Note MSA">
        <BlurCommitTextarea
          className={inputClass}
          rows={5}
          value={d.noteMsa ?? ''}
          onCommit={(noteMsa) => onPatchDetails({ noteMsa })}
        />
      </FormField>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
          Codice colore trasporto
        </p>
        <p className="mb-2 text-[10px] text-slate-500">
          Solo documentazione in questa valutazione. Non modifica il codice paziente (P) né il
          trasporto missione (T): usare «Codice colore paziente» in Esito e trasporto.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => {
            const sel = d.codiceColore != null && d.codiceColore === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onPatchDetails({ codiceColore: c })}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-1.5 ${
                  sel ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-300' : 'border-slate-200 bg-white'
                }`}
              >
                <ColoreIndicator colore={c} size="md" />
                <span className="text-[9px] font-bold uppercase">{c}</span>
              </button>
            );
          })}
          {d.codiceColore != null && (
            <button
              type="button"
              onClick={() => onPatchDetails({ codiceColore: null })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
