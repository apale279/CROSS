import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { formatTimestamp } from '../../utils/formatters';
import { displayNomePazientePma } from '../../lib/pmaDisplayName';
import { codiceMinoreFromPaziente, patchCodiceMinoreFastTrack, chiudiPazienteCodiceMinore } from '../../services/pmaCodiceMinoreService';
import { usePazienteDocument } from '../../hooks/usePazienteDocument';
import { usePmaFieldUx } from '../../pma/hooks/usePmaFieldUx';
import { btnPrimary, btnSecondary, FormField, inputClass } from '../ui/FormField';
import { PmaCodiceMinoreDatiArchiviati } from './PmaCodiceMinoreDatiArchiviati';
import { PmaPettoraleBadge } from './PmaPettoraleBadge';
import { isPercorsoCodiceMinoreTrasporto } from '../../lib/pmaDestinazioneTrasporto';

export function PmaCodiceMinoreScheda({ pazienteDocId, pmaId, pmaNome, onClose }) {
  const manifestationId = useManifestazioneId();
  const mobile = usePmaFieldUx();
  const { rawDoc, loading } = usePazienteDocument(pazienteDocId);
  const [motivo, setMotivo] = useState('');
  const [prestazione, setPrestazione] = useState('');
  const [fieldBusy, setFieldBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  const cm = rawDoc ? codiceMinoreFromPaziente(rawDoc) : null;
  const chiuso = cm?.oraFine != null;

  useEffect(() => {
    if (!cm) return;
    setMotivo(cm.motivoArrivo ?? '');
    setPrestazione(cm.trattamento ?? '');
  }, [rawDoc?._docId]);

  const saveField = useCallback(
    async (field, value) => {
      if (!manifestationId || !pazienteDocId || chiuso) return;
      setFieldBusy(true);
      try {
        await patchCodiceMinoreFastTrack(manifestationId, pazienteDocId, {
          [field === 'motivo' ? 'motivoArrivo' : 'trattamento']: value,
        });
      } catch (err) {
        alert(err?.message ?? 'Errore salvataggio');
      } finally {
        setFieldBusy(false);
      }
    },
    [manifestationId, pazienteDocId, chiuso],
  );

  const handleChiudi = async () => {
    if (!window.confirm('Chiudere il paziente codice minore?')) return;
    setCloseBusy(true);
    try {
      await chiudiPazienteCodiceMinore(manifestationId, pazienteDocId);
      onClose?.();
    } catch (err) {
      alert(err?.message ?? 'Errore chiusura');
    } finally {
      setCloseBusy(false);
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-sm text-slate-500">Caricamento…</p>;
  }

  if (!rawDoc) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Paziente non trovato.
        <button type="button" className="ml-2 text-sky-700 underline" onClick={onClose}>
          Torna al PMA
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip bg-white">
      <header
        className={
          mobile
            ? 'flex shrink-0 items-center border-b border-slate-200 bg-white px-1 pb-0.5 pt-[max(0.25rem,env(safe-area-inset-top))]'
            : 'flex shrink-0 items-center justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2'
        }
      >
        <button
          type="button"
          className={
            mobile
              ? 'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-700 active:bg-slate-100'
              : 'text-xs font-medium text-sky-700 hover:underline'
          }
          onClick={onClose}
          aria-label={mobile ? `Torna a ${pmaNome}` : undefined}
        >
          {mobile ? <ChevronLeft className="h-6 w-6" aria-hidden /> : `← ${pmaNome}`}
        </button>
        {!mobile && (
          <>
            <div className="min-w-0 flex-1">
              <h1 className="font-mono text-xl font-bold text-teal-800">{rawDoc.idPaziente}</h1>
              <p className="text-sm text-slate-600">{displayNomePazientePma(rawDoc)}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase text-violet-900">
              Codice minore
            </span>
            <PmaPettoraleBadge pettorale={rawDoc.pettorale ?? cm?.pettorale} className="shrink-0 px-2 py-1 text-xs" />
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <section className="mx-auto max-w-xl space-y-4">
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
              Anagrafica
            </h2>
            <dl className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Pettorale</dt>
                <dd className="font-mono font-bold text-slate-900">{cm?.pettorale ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Età</dt>
                <dd>{cm?.eta != null ? `${cm.eta} anni` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Nome</dt>
                <dd>{cm?.nome || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Cognome</dt>
                <dd>{cm?.cognome || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-slate-500">Inizio codice minore</dt>
                <dd className="font-mono text-xs">{formatTimestamp(cm?.oraArrivo) || '—'}</dd>
              </div>
              {chiuso ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">Fine trattamento</dt>
                  <dd className="font-mono text-xs">{formatTimestamp(cm?.oraFine)}</dd>
                </div>
              ) : null}
              {isPercorsoCodiceMinoreTrasporto(rawDoc) ? (
                <div className="sm:col-span-2 text-xs text-amber-800">
                  Da trasporto centrale
                  {rawDoc.idMissione ? ` — missione ${rawDoc.idMissione}` : ''}
                </div>
              ) : null}
            </dl>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
              Fast track astanteria
            </h2>
            <div className="space-y-3">
              <FormField label="Motivo">
                <input
                  type="text"
                  className={inputClass}
                  value={motivo}
                  disabled={chiuso || fieldBusy}
                  placeholder="Motivo breve"
                  onChange={(e) => setMotivo(e.target.value)}
                  onBlur={() => {
                    if (motivo !== (cm?.motivoArrivo ?? '')) void saveField('motivo', motivo);
                  }}
                />
              </FormField>
              <FormField label="Prestazione">
                <input
                  type="text"
                  className={inputClass}
                  value={prestazione}
                  disabled={chiuso || fieldBusy}
                  placeholder="Prestazione / trattamento"
                  onChange={(e) => setPrestazione(e.target.value)}
                  onBlur={() => {
                    if (prestazione !== (cm?.trattamento ?? '')) {
                      void saveField('prestazione', prestazione);
                    }
                  }}
                />
              </FormField>
              {!chiuso ? (
                <button
                  type="button"
                  className={`${btnPrimary} w-full sm:w-auto`}
                  disabled={closeBusy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleChiudi()}
                >
                  {closeBusy ? '…' : 'Chiudi paziente'}
                </button>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  Paziente chiuso — record in tabella codici minori.
                </p>
              )}
            </div>
          </div>

          <PmaCodiceMinoreDatiArchiviati paziente={rawDoc} manifestationId={manifestationId} />

          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose}>
            Torna al desk PMA
          </button>
        </section>
      </div>
    </div>
  );
}
