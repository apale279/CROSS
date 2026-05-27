import { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { COLLECTIONS } from '../../lib/firestorePaths';
import { useManifestazioneCollection } from '../../hooks/useManifestazioneCollection';
import { findEvento, missioniPerEvento } from '../../lib/eventoLinks';
import { canViewPmaScheda, pmaIdPerPaziente } from '../../lib/pmaModule';
import { usePazienteDocument } from '../../hooks/usePazienteDocument';
import { PazienteModuloPma } from '../../components/pazienti/moduli/PazienteModuloPma';
import { VISTA_SCHEDA } from '../../lib/pazienteSchedaModuli';
import { usePmaMobile } from '../hooks/usePmaMobile';
import type { SchedaPazienteTabId } from './scheda-paziente/schedaPazienteTabs';

const SHELL_TAB_IDS: SchedaPazienteTabId[] = [
  'anagrafica',
  'dati_centrale',
  'cartella',
  'dimissione',
];

function parseShellTab(raw: string | null): SchedaPazienteTabId {
  if (raw && SHELL_TAB_IDS.includes(raw as SchedaPazienteTabId)) {
    return raw as SchedaPazienteTabId;
  }
  return 'cartella';
}

type Props = {
  pazienteDocId: string;
  pmaId: string;
  pmaNome: string;
  onClose: () => void;
};

/** Vista PMA a schermo intero: tab anagrafica / dati centrale / cartella / dimissioni (default cartella). */
export function PmaSchedaShell({ pazienteDocId, pmaId, pmaNome, onClose }: Props) {
  const [searchParams] = useSearchParams();
  const initialTab = parseShellTab(searchParams.get('tab'));
  const mobile = usePmaMobile();
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { rawDoc, loading } = usePazienteDocument(pazienteDocId);

  const evento = useMemo(
    () => (rawDoc ? findEvento(eventi, rawDoc.eventoIdUnivoco ?? rawDoc.eventoCorrelato) : null),
    [rawDoc, eventi],
  );

  const missioniEvento = useMemo(
    () => (evento ? missioniPerEvento(missioni, evento) : []),
    [missioni, evento],
  );

  if (loading) {
    return <p className="p-8 text-center text-sm text-slate-500">Caricamento scheda…</p>;
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

  if (!canViewPmaScheda(rawDoc)) {
    return (
      <div className="p-8 text-center text-sm text-amber-900">
        Modulo PMA non attivo per questo paziente.
        <button type="button" className="ml-2 text-sky-700 underline" onClick={onClose}>
          Torna al PMA
        </button>
      </div>
    );
  }

  const pazientePmaId = pmaIdPerPaziente(rawDoc);
  if (pazientePmaId && pazientePmaId !== pmaId) {
    return (
      <div className="p-8 text-center text-sm text-amber-900">
        Questo paziente appartiene a un altro PMA.
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
            ? 'flex shrink-0 items-center border-b border-slate-200 bg-white px-1 py-0.5'
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
            </div>
            <span className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-800">
              Scheda paziente
            </span>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PazienteModuloPma
          patientDocId={pazienteDocId}
          pmaId={pmaId}
          eventi={eventi}
          evento={evento}
          missioniEvento={missioniEvento}
          vistaScheda={VISTA_SCHEDA.PMA}
          defaultTab="cartella"
          initialTab={initialTab}
        />
      </div>
    </div>
  );
}
