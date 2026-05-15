import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { User } from 'lucide-react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useEventoScheda } from '../context/EventoSchedaContext';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { useElapsedSince } from '../hooks/useElapsedSince';
import { buildStatoChangeFields } from '../lib/missionStoricoStati';
import { patchMissione } from '../services/missioniService';
import { OpsMap } from '../components/dashboard/OpsMap';
import { FloatingPanel } from '../components/dashboard/FloatingPanel';
import { MezzoDetail } from '../components/dashboard/EntityDetails';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { Modal } from '../components/ui/Modal';
import { PanelAlertIcon } from '../components/ui/PanelAlertIcon';
import { ColoreIndicator } from '../components/ui/ColoreIndicator';
import {
  coloreRowBgSoft,
  mezzoRowClass,
  statoMissioneBadgeClass,
} from '../utils/formatters';
import {
  findEvento,
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

function MissioneStatoCell({ mis, stati, onAdvance }) {
  const elapsed = useElapsedSince(mis.statoDa ?? mis.apertura);
  return (
    <td className={`${tdClass} text-right`}>
      <button
        type="button"
        onClick={(e) => onAdvance(e, mis)}
        className={`inline-block cursor-pointer rounded border px-2 py-0.5 text-xs font-bold uppercase hover:opacity-80 ${statoMissioneBadgeClass(mis.stato)}`}
        title="Clic per stato successivo"
      >
        {mis.stato}
      </button>
      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{elapsed}</p>
    </td>
  );
}

export default function DashboardPage() {
  const manifestationId = useManifestazioneId();
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { openEventoScheda } = useEventoScheda();
  const [modal, setModal] = useState(null);
  const [layout, setLayout] = useState(() => loadDashboardLayout(manifestationId));
  const [zOrder, setZOrder] = useState(['eventi', 'missioni', 'mezzi', 'mappa']);

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

  /** Stesso idMissione → cella ID missione unificata; ID evento e indirizzo su ogni riga missione. */
  const missioniAperteGrouped = useMemo(() => {
    const used = new Set();
    const groups = [];
    for (const ev of eventiAperti) {
      const rows = missioniPerEvento(missioniAperte, ev).slice().sort((a, b) => {
        const cmpM = String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it', {
          sensitivity: 'base',
        });
        if (cmpM !== 0) return cmpM;
        const mz = String(a.mezzo ?? '').localeCompare(String(b.mezzo ?? ''), 'it', {
          sensitivity: 'base',
        });
        if (mz !== 0) return mz;
        const tb = b.apertura?.toMillis?.() ?? 0;
        const ta = a.apertura?.toMillis?.() ?? 0;
        return tb - ta;
      });
      if (!rows.length) continue;
      rows.forEach((r) => used.add(r._docId));

      const subgroups = [];
      for (const r of rows) {
        const key = String(r.idMissione ?? r._docId);
        const last = subgroups[subgroups.length - 1];
        if (!last || last.key !== key) subgroups.push({ key, rows: [] });
        subgroups[subgroups.length - 1].rows.push(r);
      }

      groups.push({
        ev,
        subgroups: subgroups.map((s) => s.rows),
        rows,
        multi: rows.length > 1,
      });
    }
    const orphans = missioniAperte
      .filter((m) => !used.has(m._docId))
      .sort((a, b) => (b.apertura?.toMillis?.() ?? 0) - (a.apertura?.toMillis?.() ?? 0));
    if (orphans.length) {
      groups.push({
        ev: null,
        subgroups: orphans.map((m) => [m]),
        rows: orphans,
        multi: orphans.length > 1,
      });
    }
    groups.sort((a, b) => {
      const ta = a.rows[0]?.apertura?.toMillis?.() ?? 0;
      const tb = b.rows[0]?.apertura?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return groups;
  }, [eventiAperti, missioniAperte]);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-200">
      <FloatingPanel
        title="Eventi aperti"
        layout={layout.eventi}
        zIndex={zIndexFor('eventi')}
        onFocus={() => focusPanel('eventi')}
        onLayoutChange={(patch) => updatePanel('eventi', patch)}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Indirizzo</th>
              <th className={`${thClass} w-14 text-center whitespace-nowrap`}>Pz</th>
              <th className={`${thClass} w-12 text-center`}>Col.</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className={tdClass} />
              </tr>
            )}
            {!loading &&
              eventiAperti.map((ev) => {
                const orfano =
                  ev.stato !== false &&
                  eventoSenzaCoperturaMissione(missioni, ev);
                return (
                  <tr
                    key={ev._docId}
                    onClick={() => openEventoScheda(ev)}
                    className={`cursor-pointer hover:brightness-95 ${
                      orfano ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''
                    }`}
                  >
                    <td className={`${tdClass} font-mono font-bold`}>
                      <div className="flex items-center gap-1.5">
                        {orfano && (
                          <PanelAlertIcon
                            variant="amber"
                            title="Evento senza copertura (nessuna missione attiva)"
                          />
                        )}
                        <span>{ev.idEvento}</span>
                      </div>
                    </td>
                    <td className={tdClass}>{ev.tipoEvento}</td>
                    <td className={`${tdClass} max-w-[180px] truncate`} title={ev.indirizzo}>
                      {ev.indirizzo || '—'}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <span
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-800"
                        title={`${pazientiCountByEvento.get(ev._docId) ?? 0} pazienti`}
                      >
                        <User className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                        <span className="font-mono text-xs font-bold tabular-nums">
                          {pazientiCountByEvento.get(ev._docId) ?? 0}
                        </span>
                      </span>
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <ColoreIndicator colore={ev.colore} size="lg" />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </FloatingPanel>

      <FloatingPanel
        title="Missioni aperte"
        layout={layout.missioni}
        zIndex={zIndexFor('missioni')}
        onFocus={() => focusPanel('missioni')}
        onLayoutChange={(patch) => updatePanel('missioni', patch)}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>ID missione</th>
              <th className={thClass}>ID evento</th>
              <th className={thClass}>Mezzo</th>
              <th className={thClass}>Indirizzo evento</th>
              <th className={`${thClass} text-right`}>Stato</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className={tdClass} />
              </tr>
            )}
            {!loading &&
              missioniAperteGrouped.flatMap((group) =>
                group.subgroups.flatMap((sub) => {
                  const nMission = sub.length;
                  return sub.map((mis, riMission) => {
                    const ev =
                      group.ev ?? findEvento(eventi, mis.eventoIdUnivoco || mis.eventoCorrelato);
                    const colore = mis.codiceColore ?? ev?.colore ?? 'Bianco';
                    const daAllertare = mis.stato === 'ALLERTARE';
                    const blockClass = group.multi
                      ? 'border-l-[3px] border-l-violet-500/80 pl-0.5 shadow-[inset_3px_0_0_0_rgba(124,58,237,0.35)]'
                      : '';
                    return (
                      <tr
                        key={mis._docId}
                        onClick={() => setModal({ type: 'missione', data: mis })}
                        className={`cursor-pointer hover:brightness-95 ${coloreRowBgSoft(colore)} ${
                          daAllertare ? 'ring-1 ring-inset ring-red-400' : ''
                        } ${blockClass}`}
                      >
                        {riMission === 0 && (
                          <td
                            className={`${tdClass} align-top font-mono font-bold ${nMission > 1 ? 'border-r border-r-violet-200/70' : ''}`}
                            rowSpan={nMission}
                          >
                            <div className="flex items-center gap-1.5">
                              {sub.some((x) => x.stato === 'ALLERTARE') && (
                                <PanelAlertIcon variant="red" title="Missione da allertare" />
                              )}
                              <span>{mis.idMissione}</span>
                            </div>
                          </td>
                        )}
                        <td className={`${tdClass} font-mono`}>
                          {mis.eventoCorrelato ?? ev?.idEvento ?? '—'}
                        </td>
                        <td className={`${tdClass} font-mono`}>{mis.mezzo}</td>
                        <td
                          className={`${tdClass} max-w-[160px] truncate`}
                          title={ev?.indirizzo}
                        >
                          {ev?.indirizzo || '—'}
                        </td>
                        <MissioneStatoCell mis={mis} stati={stati} onAdvance={avanzaStatoMissione} />
                      </tr>
                    );
                  });
                }),
              )}
          </tbody>
        </table>
      </FloatingPanel>

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
          title={`Mezzo ${modal.data.sigla ?? modal.data._docId}`}
          onClose={() => setModal(null)}
        >
          <MezzoDetail mezzo={modal.data} onDeleted={() => setModal(null)} />
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
