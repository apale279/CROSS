import { useCallback, useEffect, useState } from 'react';
import { etaDaDataNascita } from '../../lib/excelPartecipanti';
import { patientDocToDraftFields } from '../../lib/pazienteDraftMerge';
import { STATO_PZ_PMA, statoPzPmaLabel } from '../../lib/pmaModule';
import { patchPaziente } from '../../services/pazientiService';
import { setStatoPmaAutopresentato } from '../../services/pmaStatoService';
import { FormField, selectClass } from '../ui/FormField';
import { PazienteAnagraficaFields } from './PazienteAnagraficaFields';
import { PazienteTipoEventoFields } from './PazienteTipoEventoFields';

function parseEtaDraft(s) {
  if (s === '' || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const STATI_AUTO_PMA = [
  { value: STATO_PZ_PMA.IN_ATTESA, label: 'In attesa (fuori tenda)' },
  { value: STATO_PZ_PMA.IN_CARICO, label: 'In carico (in tenda)' },
];

/**
 * Tab anagrafica PMA: stesso layout della scheda paziente centrale.
 */
export function PazienteAnagraficaPmaTab({
  rawDoc,
  impostazioni,
  manifestationId,
  patientDocId,
  readOnly,
  canEdit,
  isAutopresentato = false,
  canEditStatoPma = false,
  eventoResolved,
  tipoEv,
  dettaglioEv,
  onTipoEvChange,
  onDettaglioEvChange,
  onFlushEvento,
  showEventoDettaglio = false,
  eventoEditable = false,
}) {
  const [draft, setDraft] = useState(() => patientDocToDraftFields(rawDoc ?? {}));
  const [savingStato, setSavingStato] = useState(false);
  const statoPma = rawDoc?.statoPzPma ?? STATO_PZ_PMA.IN_ATTESA;

  useEffect(() => {
    if (rawDoc) setDraft(patientDocToDraftFields(rawDoc));
  }, [rawDoc?._docId, rawDoc?.nome, rawDoc?.cognome, rawDoc?.pettorale, rawDoc?.telefono]);

  const patchAnagrafica = useCallback(
    async (fields) => {
      if (readOnly || !manifestationId || !patientDocId) return;
      await patchPaziente(manifestationId, patientDocId, fields);
    },
    [readOnly, manifestationId, patientDocId],
  );

  const onBlurField = useCallback(
    (key) => {
      if (readOnly || !canEdit) return;
      if (key === 'pettorale') {
        void patchAnagrafica({
          pettorale:
            draft.pettorale !== '' && draft.pettorale != null ? Number(draft.pettorale) : null,
        });
        return;
      }
      if (key === 'dataNascita') {
        void patchAnagrafica({
          dataNascita: draft.dataNascita,
          eta: etaDaDataNascita(draft.dataNascita),
        });
        return;
      }
      if (key === 'eta') {
        void patchAnagrafica({ eta: parseEtaDraft(draft.eta) });
        return;
      }
      if (key === 'sesso') {
        void patchAnagrafica({ sesso: draft.sesso });
        return;
      }
      void patchAnagrafica({ [key]: draft[key] ?? '' });
    },
    [readOnly, canEdit, draft, patchAnagrafica],
  );

  const onStatoPmaChange = async (next) => {
    if (!canEditStatoPma || !manifestationId || !patientDocId) return;
    setSavingStato(true);
    try {
      await setStatoPmaAutopresentato(manifestationId, patientDocId, next);
    } catch (err) {
      alert(err.message ?? 'Errore aggiornamento stato PMA');
    } finally {
      setSavingStato(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {readOnly && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Paziente inviato dalla centrale: anagrafica in sola lettura. La cartella clinica è
          modificabile dal personale in tenda quando il paziente è in carico.
        </p>
      )}

      <dl className="grid gap-3 md:grid-cols-2">
        <FormField label="Stato PMA">
          {canEditStatoPma ? (
            <select
              className={selectClass}
              value={statoPma}
              disabled={savingStato}
              onChange={(e) => void onStatoPmaChange(e.target.value)}
            >
              {STATI_AUTO_PMA.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="font-semibold text-slate-800">
              {statoPzPmaLabel(rawDoc?.statoPzPma) ?? '—'}
            </p>
          )}
        </FormField>
      </dl>
      {!isAutopresentato && (
        <p className="text-xs text-slate-500">
          Paziente da centrale: lo stato PMA segue la missione (DIRETTO H → in arrivo, ARRIVATO H →
          in carico). Il medico può prendere in carico manualmente dalla dashboard PMA.
        </p>
      )}

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Anagrafica</p>
        <PazienteAnagraficaFields
          draft={draft}
          readOnly={readOnly || !canEdit}
          onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
          onBlurField={onBlurField}
        />
      </div>

      {showEventoDettaglio && (
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-bold uppercase text-slate-600">Evento</p>
          {eventoResolved?.idEvento && (
            <FormField label="Evento correlato" className="mb-3">
              <p className="font-mono font-semibold text-slate-800">{eventoResolved.idEvento}</p>
            </FormField>
          )}
          <p className="mb-2 text-xs font-medium text-slate-500">Tipo e dettaglio</p>
          {eventoEditable ? (
            <PazienteTipoEventoFields
              impostazioni={impostazioni}
              tipoEvento={tipoEv}
              dettaglioEvento={dettaglioEv}
              onChange={(partial) => {
                const nextTipo = partial.tipoEvento ?? tipoEv;
                const nextDet = partial.dettaglioEvento ?? dettaglioEv;
                onTipoEvChange(nextTipo);
                onDettaglioEvChange(nextDet);
                void onFlushEvento(nextTipo, nextDet);
              }}
            />
          ) : (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Tipo evento</dt>
                <dd className="text-slate-800">{tipoEv || eventoResolved?.tipoEvento || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Dettaglio evento</dt>
                <dd className="text-slate-800">
                  {dettaglioEv || eventoResolved?.dettaglioEvento || '—'}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
