import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useEventoScheda } from '../context/EventoSchedaContext';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { useOperativoDashboardData } from '../hooks/useOperativoDashboardData';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { PopOutButton } from '../components/ui/PopOutButton';
import { MinimizeToDockButton } from '../components/ui/MinimizeToDockButton';
import { KioskDockBar } from '../components/dashboard/KioskDockBar';
import { useKioskPopOutContext } from '../context/KioskPopOutContext';
import { StatoMezziTable } from '../components/dashboard/StatoMezziTable';
import { TelegramBotToggle } from '../components/telegram/TelegramBotToggle';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { patchMissione } from '../services/missioniService';
import { OpsMap } from '../components/dashboard/OpsMap';
import { MappaTatticaDashboard } from '../components/dashboard/MappaTatticaDashboard';
import { EventiMissioniTable } from '../components/dashboard/EventiMissioniTable';
import { DashboardPmaPanel } from '../components/dashboard/DashboardPmaPanel';
import { FloatingPanel } from '../components/dashboard/FloatingPanel';
import { FullscreenPanel } from '../components/dashboard/FullscreenPanel';
import { MezzoScheda } from '../components/mezzi/MezzoScheda';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { Modal } from '../components/ui/Modal';
import { PmaMapModal } from '../components/impostazioni/PmaMapModal';
import { DiarioImportantTicker } from '../components/diario/DiarioImportantTicker';
import { DiarioNotaModal } from '../components/diario/DiarioNotaModal';
import { useDiarioNotaActions } from '../hooks/useDiarioNotaActions';
import { useDiarioTelegramBroadcast } from '../hooks/useDiarioTelegramBroadcast';
import { nextStatoMissione } from '../utils/missionStati';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  loadDashboardLayout,
  normalizeDashboardLayout,
  PMA_W,
  saveDashboardLayout,
} from '../lib/dashboardLayout';

export default function DashboardPage() {
  const navigate = useNavigate();
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const { fullCentrale } = usePmaAccess();
  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const {
    eventi,
    eventiAperti,
    missioni,
    mezzi,
    mezziSorted,
    operativoBlocks,
    operativoStats,
    pazientiCountByEvento,
    pazientiTrasportoByMissione,
    pazienti,
    loading,
    stati,
  } = useOperativoDashboardData();
  const { data: noteDiario, loading: loadingDiario } = useManifestazioneCollection(
    COLLECTIONS.note_diario,
  );
  const { openEventoScheda } = useEventoScheda();
  const [modal, setModal] = useState(null);
  const [diarioModal, setDiarioModal] = useState(null);
  const {
    saving: savingDiario,
    updateNota: updateNotaDiario,
    toggleChiusa: toggleChiusaDiario,
    toggleImportante: toggleImportanteDiario,
    removeNota: removeNotaDiario,
    allertaPmaNota: allertaPmaDiario,
  } = useDiarioNotaActions({
    onAfterDelete: (docId) => {
      setDiarioModal((m) => (m?.nota?._docId === docId ? null : m));
    },
  });
  const { broadcast: broadcastDiario, broadcasting: broadcastingDiario } =
    useDiarioTelegramBroadcast();
  const [layout, setLayout] = useState(() => loadDashboardLayout(manifestationId));
  const [zOrder, setZOrder] = useState(['operativo', 'mezzi', 'mappa', 'pma']);
  const [operativoFullscreen, setOperativoFullscreen] = useState(false);
  const [dashboardView, setDashboardView] = useState('operativo');
  const {
    dockedPanelIds,
    popOutPanel,
    dockPanel,
    restorePanel,
    isPanelVisible,
  } = useKioskPopOutContext();

  const panelHeaderActions = (panelId, extra = null) => (
    <>
      <PopOutButton panelId={panelId} onPopOut={popOutPanel} />
      <MinimizeToDockButton panelId={panelId} onDock={() => dockPanel(panelId, 'embedded')} />
      {extra}
    </>
  );

  useEffect(() => {
    setLayout(loadDashboardLayout(manifestationId));
  }, [manifestationId]);

  useEffect(() => {
    const onReset = () => {
      setLayout(normalizeDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT }));
      setZOrder(['operativo', 'mezzi', 'mappa', 'pma']);
      setOperativoFullscreen(false);
      setDashboardView('operativo');
    };
    window.addEventListener('dashboard-layout-reset', onReset);
    return () => window.removeEventListener('dashboard-layout-reset', onReset);
  }, []);

  useEffect(() => {
    saveDashboardLayout(manifestationId, layout);
  }, [layout, manifestationId]);

  const updatePanel = useCallback((id, patch) => {
    setLayout((prev) => normalizeDashboardLayout({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const focusPanel = useCallback((id) => {
    setZOrder((prev) => {
      if (id === 'mappa' || id === 'pma') {
        const rest = prev.filter((x) => x !== 'mappa' && x !== 'pma');
        return [...rest, 'mappa', 'pma'];
      }
      return [...prev.filter((x) => x !== id), id];
    });
  }, []);

  const zIndexFor = (id) => 10 + zOrder.indexOf(id);

  const avanzaStatoMissione = async (e, mis) => {
    e.stopPropagation();
    const nuovo = nextStatoMissione(mis.stato ?? 'ALLERTARE', stati);
    if (nuovo === mis.stato) return;
    await patchMissione(
      manifestationId,
      mis._docId,
      buildStatoChangeFields(mis, nuovo),
      mis.mezzo,
    );
  };

  const operativoTable = (
    <EventiMissioniTable
      loading={loading}
      blocks={operativoBlocks}
      pazientiCountByEvento={pazientiCountByEvento}
      pazientiTrasportoByMissione={pazientiTrasportoByMissione}
      eventi={eventi}
      telegramEnabled={telegramEnabled}
      onOpenEvento={openEventoScheda}
      onOpenMissione={(mis) => setModal({ type: 'missione', data: mis })}
      onAdvanceStato={avanzaStatoMissione}
    />
  );

  const operativoSubtitle = `${operativoStats.eventCount} eventi · ${operativoStats.missionCount} missioni`;

  const diarioModalNota = useMemo(() => {
    if (!diarioModal?.nota?._docId) return diarioModal?.nota ?? null;
    return noteDiario.find((n) => n._docId === diarioModal.nota._docId) ?? diarioModal.nota;
  }, [diarioModal, noteDiario]);

  const handleDiarioSave = async (payload) => {
    if (!diarioModalNota?._docId) return;
    await updateNotaDiario(diarioModalNota._docId, payload);
    setDiarioModal((m) =>
      m?.nota ? { ...m, nota: { ...m.nota, ...payload } } : m,
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-200">
      <header className="z-[30] flex shrink-0 flex-col border-b border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <nav className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setDashboardView('operativo')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                dashboardView === 'operativo'
                  ? 'bg-white text-sky-800 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Operativo
            </button>
            <button
              type="button"
              onClick={() => setDashboardView('tattica')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                dashboardView === 'tattica'
                  ? 'bg-white text-sky-800 shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mappa tattica
            </button>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <KioskDockBar dockedPanelIds={dockedPanelIds} onRestore={restorePanel} />
            <TelegramBotToggle />
          </div>
        </div>
        <DiarioImportantTicker
          note={noteDiario}
          loading={loadingDiario}
          onOpenNota={(nota) => setDiarioModal({ mode: 'view', nota })}
        />
      </header>

      {dashboardView === 'tattica' ? (
        <div className="min-h-0 flex-1">
          <MappaTatticaDashboard eventi={eventi} missioni={missioni} mezzi={mezzi} />
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
      {isPanelVisible('operativo') && (
      <FloatingPanel
        title="Eventi e missioni"
        layout={layout.operativo ?? DEFAULT_DASHBOARD_LAYOUT.operativo}
        zIndex={zIndexFor('operativo')}
        onFocus={() => focusPanel('operativo')}
        onLayoutChange={(patch) => updatePanel('operativo', patch)}
        headerActions={panelHeaderActions(
          'operativo',
          <button
            type="button"
            onClick={() => setOperativoFullscreen(true)}
            className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Apri a tutto schermo (scorri l’elenco completo)"
            aria-label="Apri eventi e missioni a tutto schermo"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>,
        )}
      >
        {operativoTable}
      </FloatingPanel>
      )}

      {operativoFullscreen && (
        <FullscreenPanel
          contained
          title="Eventi e missioni"
          subtitle={operativoSubtitle}
          onClose={() => setOperativoFullscreen(false)}
        >
          {operativoTable}
        </FullscreenPanel>
      )}

      {isPanelVisible('mezzi') && (
      <FloatingPanel
        title="Stato mezzi"
        layout={layout.mezzi}
        zIndex={zIndexFor('mezzi')}
        onFocus={() => focusPanel('mezzi')}
        onLayoutChange={(patch) => updatePanel('mezzi', patch)}
        headerActions={panelHeaderActions('mezzi')}
      >
        <StatoMezziTable
          loading={loading}
          mezzi={mezziSorted}
          onOpenMezzo={(m) => setModal({ type: 'mezzo', data: m })}
        />
      </FloatingPanel>
      )}

      {isPanelVisible('mappa') && (
      <FloatingPanel
        title="Mappa"
        layout={layout.mappa}
        zIndex={zIndexFor('mappa')}
        onFocus={() => focusPanel('mappa')}
        onLayoutChange={(patch) => updatePanel('mappa', patch)}
        layoutConstraints={{
          maxW: 1 - (layout.mappa?.x ?? 0.5) - (layout.pma?.w ?? PMA_W),
        }}
        headerActions={panelHeaderActions('mappa')}
      >
        <OpsMap
          embedded
          eventi={eventiAperti}
          mezzi={mezzi}
          missioni={missioni}
          pmaList={impostazioni.pma ?? []}
          onSelect={(payload) => {
            if (payload.type === 'evento') openEventoScheda(payload.data);
            if (payload.type === 'mezzo') setModal({ type: 'mezzo', data: payload.data });
            if (payload.type === 'pma') setModal({ type: 'pma', data: payload.data });
          }}
        />
      </FloatingPanel>
      )}

      {isPanelVisible('pma') && (
      <FloatingPanel
        title="Dashboard PMA"
        layout={layout.pma ?? DEFAULT_DASHBOARD_LAYOUT.pma}
        zIndex={zIndexFor('pma')}
        onFocus={() => focusPanel('pma')}
        onLayoutChange={(patch) => updatePanel('pma', patch)}
        headerActions={panelHeaderActions('pma')}
      >
        <DashboardPmaPanel pazienti={pazienti} loading={loading} />
      </FloatingPanel>
      )}

      {modal?.type === 'mezzo' && (
        <Modal
          title={`Scheda mezzo ${modal.data.sigla ?? modal.data._docId}`}
          onClose={() => setModal(null)}
        >
          <MezzoScheda
            mezzo={
              mezzi.find(
                (m) =>
                  (m.sigla ?? m._docId) ===
                  (modal.data.sigla ?? modal.data._docId),
              ) ?? modal.data
            }
            onDeleted={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'pma' && (
        <Modal title={`PMA ${modal.data.nome ?? ''}`} onClose={() => setModal(null)} wide>
          <PmaMapModal pma={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === 'missione' && (
        <Modal
          title={`Missione ${modal.data.idMissione}`}
          onClose={() => setModal(null)}
        >
          <MissioneScheda
            missione={
              missioni.find((m) => m._docId === modal.data._docId) ?? modal.data
            }
            eventi={eventi}
            mezzi={mezzi}
            allMissioni={missioni}
            existingEventi={eventi}
            pazienti={pazienti}
            onOpenEvento={(ev) => {
              setModal(null);
              openEventoScheda(ev);
            }}
            onOpenPaziente={(p) => {
              setModal(null);
              navigate(`/pazienti?open=${encodeURIComponent(p._docId)}`);
            }}
          />
        </Modal>
      )}

      {diarioModal && diarioModalNota && (
        <DiarioNotaModal
          nota={diarioModalNota}
          mode={diarioModal.mode}
          saving={savingDiario}
          onClose={() => setDiarioModal(null)}
          onSave={handleDiarioSave}
          onDelete={async () => {
            await removeNotaDiario(diarioModalNota._docId);
          }}
          onToggleChiusa={async (aperta) => {
            await toggleChiusaDiario(diarioModalNota, aperta);
          }}
          onToggleImportante={async (importante) => {
            await toggleImportanteDiario(diarioModalNota, importante);
          }}
          onAllertaPma={
            fullCentrale && diarioModal?.mode === 'view'
              ? async (nota) => {
                  await allertaPmaDiario(nota);
                }
              : undefined
          }
          onBroadcastTelegram={diarioModal?.mode === 'view' ? broadcastDiario : undefined}
          broadcasting={broadcastingDiario}
        />
      )}
        </div>
      )}
    </div>
  );
}
