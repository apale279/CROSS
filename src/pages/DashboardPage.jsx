import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useEventoScheda } from '../context/EventoSchedaContext';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { TelegramBotToggle } from '../components/telegram/TelegramBotToggle';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { patchMissione } from '../services/missioniService';
import { OpsMap } from '../components/dashboard/OpsMap';
import { EventiMissioniTable } from '../components/dashboard/EventiMissioniTable';
import { FloatingPanel } from '../components/dashboard/FloatingPanel';
import { FullscreenPanel } from '../components/dashboard/FullscreenPanel';
import { MezzoScheda } from '../components/mezzi/MezzoScheda';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { Modal } from '../components/ui/Modal';
import { mezzoRowClass } from '../utils/formatters';
import {
  missioniPerEvento,
  pazientiPerEvento,
  eventoSenzaCoperturaMissione,
} from '../lib/eventoLinks';
import { nextStatoMissione } from '../utils/missionStati';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  loadDashboardLayout,
  saveDashboardLayout,
} from '../lib/dashboardLayout';

const thClass =
  'sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600 backdrop-blur';
const tdClass = 'border-t border-slate-200/80 px-3 py-2 text-sm text-slate-900';

export default function DashboardPage() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { openEventoScheda } = useEventoScheda();
  const [modal, setModal] = useState(null);
  const [layout, setLayout] = useState(() => loadDashboardLayout(manifestationId));
  const [zOrder, setZOrder] = useState(['operativo', 'mezzi', 'mappa']);
  const [operativoFullscreen, setOperativoFullscreen] = useState(false);

  useEffect(() => {
    setLayout(loadDashboardLayout(manifestationId));
  }, [manifestationId]);

  useEffect(() => {
    const onReset = () => setLayout({ ...DEFAULT_DASHBOARD_LAYOUT });
    window.addEventListener('dashboard-layout-reset', onReset);
    return () => window.removeEventListener('dashboard-layout-reset', onReset);
  }, []);

  useEffect(() => {
    saveDashboardLayout(manifestationId, layout);
  }, [layout, manifestationId]);

  const updatePanel = useCallback((id, patch) => {
    setLayout((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const focusPanel = useCallback((id) => {
    setZOrder((prev) => [...prev.filter((x) => x !== id), id]);
  }, []);

  const zIndexFor = (id) => 10 + zOrder.indexOf(id);

  const eventiAperti = useMemo(() => eventi.filter((e) => e.stato !== false), [eventi]);

  const pazientiCountByEvento = useMemo(() => {
    const m = new Map();
    for (const ev of eventiAperti) {
      m.set(ev._docId, pazientiPerEvento(pazienti, ev).length);
    }
    return m;
  }, [eventiAperti, pazienti]);
  const missioniAperte = useMemo(() => missioni.filter((m) => m.aperta !== false), [missioni]);

  const sortMissioni = (list) =>
    list.slice().sort((a, b) => {
      const cmpM = String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it', {
        sensitivity: 'base',
      });
      if (cmpM !== 0) return cmpM;
      const mz = String(a.mezzo ?? '').localeCompare(String(b.mezzo ?? ''), 'it', {
        sensitivity: 'base',
      });
      if (mz !== 0) return mz;
      return (b.apertura?.toMillis?.() ?? 0) - (a.apertura?.toMillis?.() ?? 0);
    });

  /** Blocchi evento + missioni: evento a sinistra (rowSpan), missioni a destra. */
  const operativoBlocks = useMemo(() => {
    const usedMissionIds = new Set();
    const blocks = [];

    for (const ev of eventiAperti) {
      const missions = sortMissioni(missioniPerEvento(missioniAperte, ev));
      missions.forEach((m) => usedMissionIds.add(m._docId));
      blocks.push({
        key: `ev-${ev._docId}`,
        ev,
        missions,
        orfano: ev.stato !== false && eventoSenzaCoperturaMissione(missioni, ev),
      });
    }

    const orphans = sortMissioni(missioniAperte.filter((m) => !usedMissionIds.has(m._docId)));
    if (orphans.length) {
      blocks.push({ key: 'orphan-missions', ev: null, missions: orphans, orfano: false });
    }

    const blockTime = (b) => {
      if (b.missions.length) return b.missions[0]?.apertura?.toMillis?.() ?? 0;
      return b.ev?.apertura?.toMillis?.() ?? 0;
    };
    blocks.sort((a, b) => blockTime(b) - blockTime(a));
    return blocks;
  }, [eventiAperti, missioniAperte, missioni]);

  const operativoStats = useMemo(() => {
    const eventCount = operativoBlocks.filter((b) => b.ev).length;
    const missionCount = operativoBlocks.reduce((s, b) => s + b.missions.length, 0);
    return { eventCount, missionCount };
  }, [operativoBlocks]);

  const mezziSorted = useMemo(
    () =>
      [...mezzi].sort((a, b) =>
        (a.sigla ?? a._docId).localeCompare(b.sigla ?? b._docId),
      ),
    [mezzi],
  );

  const loading = loadingE || loadingM || loadingZ || loadingP;
  const stati = DEFAULT_IMPOSTAZIONI.statiMissione;

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
      eventi={eventiAperti}
      telegramEnabled={telegramEnabled}
      onOpenEvento={openEventoScheda}
      onOpenMissione={(mis) => setModal({ type: 'missione', data: mis })}
      onAdvanceStato={avanzaStatoMissione}
    />
  );

  const operativoSubtitle = `${operativoStats.eventCount} eventi · ${operativoStats.missionCount} missioni`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-200">
      <div className="absolute left-2 top-2 z-[25]">
        <TelegramBotToggle />
      </div>
      <FloatingPanel
        title="Eventi e missioni"
        layout={layout.operativo ?? DEFAULT_DASHBOARD_LAYOUT.operativo}
        zIndex={zIndexFor('operativo')}
        onFocus={() => focusPanel('operativo')}
        onLayoutChange={(patch) => updatePanel('operativo', patch)}
        headerActions={
          <button
            type="button"
            onClick={() => setOperativoFullscreen(true)}
            className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Apri a tutto schermo (scorri l’elenco completo)"
            aria-label="Apri eventi e missioni a tutto schermo"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        }
      >
        {operativoTable}
      </FloatingPanel>

      {operativoFullscreen && (
        <FullscreenPanel
          title="Eventi e missioni"
          subtitle={operativoSubtitle}
          onClose={() => setOperativoFullscreen(false)}
        >
          {operativoTable}
        </FullscreenPanel>
      )}

      <FloatingPanel
        title="Stato mezzi"
        layout={layout.mezzi}
        zIndex={zIndexFor('mezzi')}
        onFocus={() => focusPanel('mezzi')}
        onLayoutChange={(patch) => updatePanel('mezzi', patch)}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Sigla</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Stato</th>
              <th className={thClass}>Operativo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className={tdClass} />
              </tr>
            )}
            {!loading &&
              mezziSorted.map((m) => {
                const sigla = m.sigla ?? m._docId;
                return (
                  <tr
                    key={sigla}
                    onClick={() => setModal({ type: 'mezzo', data: m })}
                    className={`cursor-pointer ${mezzoRowClass(m)}`}
                  >
                    <td className={`${tdClass} font-mono font-bold`}>{sigla}</td>
                    <td className={tdClass}>{m.tipo}</td>
                    <td className={tdClass}>
                      <span
                        className={`font-semibold ${
                          (m.statoMezzo ?? 'Disponibile') === 'Disponibile'
                            ? 'text-emerald-800'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.statoMezzo ?? 'Disponibile'}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={
                          m.operativo !== false
                            ? 'font-semibold text-emerald-800'
                            : 'font-semibold text-red-800'
                        }
                      >
                        {m.operativo !== false ? 'Sì' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </FloatingPanel>

      <FloatingPanel
        title="Mappa"
        layout={layout.mappa}
        zIndex={zIndexFor('mappa')}
        onFocus={() => focusPanel('mappa')}
        onLayoutChange={(patch) => updatePanel('mappa', patch)}
      >
        <OpsMap
          eventi={eventiAperti}
          mezzi={mezzi}
          onSelect={(payload) => {
            if (payload.type === 'evento') openEventoScheda(payload.data);
            if (payload.type === 'mezzo') setModal({ type: 'mezzo', data: payload.data });
          }}
        />
      </FloatingPanel>

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
            onOpenEvento={(ev) => {
              setModal(null);
              openEventoScheda(ev);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
