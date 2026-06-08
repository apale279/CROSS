import { useCallback, useEffect, useState } from 'react';
import { etaDaDataNascita } from '../../lib/excelPartecipanti';
import { patientDocToDraftFields } from '../../lib/pazienteDraftMerge';
import {
  findPmaRawEntry,
  normalizeStatoPzPma,
  STATO_PZ_PMA,
  statoPzPmaLabel,
} from '../../lib/pmaModule';
import { pmaHaGrigliaPostiLetto } from '../../lib/pmaPostiLetto';
import { notifyPmaDeskError, notifyPmaDeskSoftIssue } from '../../lib/pmaDeskFeedback';
import { patchPaziente } from '../../services/pazientiService';
import { assegnaPostoLettoConPresaInCarico } from '../../services/pmaPostoLettoService';
import { prendiInCaricoPma, setStatoPmaAutopresentato } from '../../services/pmaStatoService';
import { patchPazientePmaGranular } from '../../pma/lib/pazientePmaPatch';
import { PmaCodiceColoreField } from '../../pma/components/scheda-paziente/PmaCodiceColoreField';
import { PmaRendiCodiceMinoreBlock } from '../pma/PmaRendiCodiceMinoreBlock';
import { btnDanger, FormField, selectClass } from '../ui/FormField';
import { PazienteAnagraficaFields } from './PazienteAnagraficaFields';
import { dettagliPerTipoEvento } from '../../lib/impostazioniNormalize';
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
  canEditColore = false,
  showRendiCodiceMinore = false,
  rendiCodiceMinoreAtTop = false,
  onRendiCodiceMinore,
  rendiCodiceMinoreBusy = false,
  pmaId = null,
  vistaPma = false,
}) {
  const [draft, setDraft] = useState(() => patientDocToDraftFields(rawDoc ?? {}));
  const [savingStato, setSavingStato] = useState(false);
  const [prendiInCaricoBusy, setPrendiInCaricoBusy] = useState(false);
  const statoPma = rawDoc?.statoPzPma ?? STATO_PZ_PMA.IN_ATTESA;
  const statoPzNormalizzato = normalizeStatoPzPma(rawDoc?.statoPzPma);
  const usaGrigliaLetti = pmaHaGrigliaPostiLetto(
    pmaId ? findPmaRawEntry(impostazioni, pmaId) : null,
  );
  const mostraPrendiInCarico =
    vistaPma &&
    statoPzNormalizzato !== STATO_PZ_PMA.IN_CARICO &&
    statoPzNormalizzato !== STATO_PZ_PMA.DIMESSO;

  useEffect(() => {
    if (rawDoc) setDraft(patientDocToDraftFields(rawDoc));
  }, [rawDoc?._docId]);

  const patchAnagrafica = useCallback(
    async (fields) => {
      if (readOnly || !manifestationId || !patientDocId) return;
      await patchPaziente(manifestationId, patientDocId, fields);
    },
    [readOnly, manifestationId, patientDocId],
  );

  const onBlurField = useCallback(
    (key, value) => {
      if (readOnly || !canEdit) return;
      const fieldValue = value !== undefined ? value : draft[key];
      if (key === 'pettorale') {
        void patchAnagrafica({
          pettorale:
            fieldValue !== '' && fieldValue != null ? Number(fieldValue) : null,
        });
        return;
      }
      if (key === 'dataNascita') {
        void patchAnagrafica({
          dataNascita: fieldValue,
          eta: etaDaDataNascita(fieldValue),
        });
        return;
      }
      if (key === 'eta') {
        void patchAnagrafica({ eta: parseEtaDraft(fieldValue) });
        return;
      }
      if (key === 'sesso') {
        void patchAnagrafica({ sesso: fieldValue });
        return;
      }
      void patchAnagrafica({ [key]: fieldValue ?? '' });
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

  const codiceColore = rawDoc?.pmaScheda?.codice_colore ?? '';

  const patchColore = useCallback(
    async (c) => {
      if (!canEditColore || !manifestationId || !patientDocId) return;
      await patchPazientePmaGranular(manifestationId, patientDocId, { codice_colore: c });
    },
    [canEditColore, manifestationId, patientDocId],
  );

  const onPrendiInCarico = async () => {
    if (!mostraPrendiInCarico || !manifestationId || !patientDocId || prendiInCaricoBusy) return;
    setPrendiInCaricoBusy(true);
    try {
      if (usaGrigliaLetti) {
        const result = await assegnaPostoLettoConPresaInCarico(
          manifestationId,
          patientDocId,
          null,
          rawDoc,
          [],
        );
        if (result.warning) {
          notifyPmaDeskSoftIssue(
            result.warning,
            'Il paziente è in carico: continua la cartella clinica.',
          );
        }
      } else {
        await prendiInCaricoPma(manifestationId, patientDocId);
      }
    } catch (err) {
      notifyPmaDeskError(err?.message ?? 'Errore presa in carico');
    } finally {
      setPrendiInCaricoBusy(false);
    }
  };

  const rendiCodiceMinoreBlock = showRendiCodiceMinore ? (
    <PmaRendiCodiceMinoreBlock
      busy={rendiCodiceMinoreBusy}
      onClick={() => void onRendiCodiceMinore?.()}
    />
  ) : null;

  return (
    <div className="space-y-4 text-sm">
      {rendiCodiceMinoreAtTop ? rendiCodiceMinoreBlock : null}

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
                if (partial.tipoEvento !== undefined) {
                  void onFlushEvento(nextTipo, nextDet);
                  return;
                }
                const opzioni = dettagliPerTipoEvento(impostazioni, nextTipo);
                if (opzioni.length > 0) {
                  void onFlushEvento(nextTipo, nextDet);
                }
              }}
              onDettaglioBlur={(value) => void onFlushEvento(tipoEv, value)}
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

      <div className="border-t border-slate-200 pt-3">
        <PmaCodiceColoreField
          value={codiceColore}
          canEdit={canEditColore}
          compact
          onChange={(c) => void patchColore(c)}
        />
      </div>

      {showRendiCodiceMinore && !rendiCodiceMinoreAtTop ? rendiCodiceMinoreBlock : null}

      {mostraPrendiInCarico ? (
        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            className={`${btnDanger} w-full font-bold disabled:opacity-50`}
            disabled={prendiInCaricoBusy}
            onClick={() => void onPrendiInCarico()}
          >
            {prendiInCaricoBusy ? '…' : 'Prendi in carico'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
