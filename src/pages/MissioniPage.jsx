import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { formatTimeOnly, statoMissioneBadgeClass } from '../utils/formatters';
import { MissioneTelegramSendButton } from '../components/telegram/MissioneTelegramSendButton';
import { findEventoForMissione } from '../lib/telegramMissionPayload';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { MissionePmaInvioPsBadge } from '../components/missioni/MissionePmaInvioPsBadge';
import { Modal } from '../components/ui/Modal';
import { PazienteScheda } from '../components/pazienti/PazienteScheda';
import { findEvento, missioniPerEvento } from '../lib/eventoLinks';

export default function MissioniPage() {
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { impostazioni } = useImpostazioni();
  const [missioneModal, setMissioneModal] = useState(null);
  const [pazienteModal, setPazienteModal] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const loading = loadingM || loadingE || loadingZ || loadingP;

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || loading) return;
    const m = missioni.find((x) => x._docId === openId);
    if (m) setMissioneModal(m);
    setSearchParams({}, { replace: true });
  }, [searchParams, missioni, loading, setSearchParams]);

  const sorted = [...missioni].sort((a, b) => {
    const ta = a.apertura?.toMillis?.() ?? 0;
    const tb = b.apertura?.toMillis?.() ?? 0;
    return tb - ta;
  });

  const thClass =
    'bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600';
  const tdClass = 'border-t border-slate-200 px-4 py-3 text-sm';

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-4 text-xl font-bold uppercase text-slate-900">Missioni</h2>
      <div className="overflow-hidden rounded border border-slate-300 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>Stato</th>
              <th className={thClass}>Mezzo</th>
              <th className={thClass}>Evento</th>
              <th className={thClass}>Aperta</th>
              <th className={thClass}>Ora</th>
              <th className={`${thClass} text-center`}>Telegram</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={tdClass} />
              </tr>
            ) : (
              sorted.map((row) => {
                const evento = findEventoForMissione(eventi, row);
                return (
                  <tr
                    key={row._docId}
                    onClick={() => setMissioneModal(row)}
                    className="cursor-pointer hover:bg-violet-50"
                  >
                    <td className={`${tdClass} font-mono font-bold`}>
                      <span className="inline-flex items-center gap-1.5">
                        {row.idMissione}
                        <MissionePmaInvioPsBadge missione={row} />
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase ${statoMissioneBadgeClass(row.stato)}`}
                      >
                        {row.stato}
                      </span>
                    </td>
                    <td className={`${tdClass} font-mono`}>{row.mezzo}</td>
                    <td className={`${tdClass} font-mono`}>{row.eventoCorrelato}</td>
                    <td className={tdClass}>{row.aperta !== false ? 'Sì' : 'No'}</td>
                    <td className={`${tdClass} font-mono`}>{formatTimeOnly(row.apertura)}</td>
                    <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                      <MissioneTelegramSendButton
                        missione={row}
                        evento={evento}
                        eventi={eventi}
                        telegramEnabled={telegramEnabled}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {missioneModal && (
        <Modal
          title={`Missione ${missioneModal.idMissione}`}
          onClose={() => setMissioneModal(null)}
          scheda
        >
          <MissioneScheda
            missione={
              missioni.find((m) => m._docId === missioneModal._docId) ?? missioneModal
            }
            eventi={eventi}
            mezzi={mezzi}
            allMissioni={missioni}
            existingEventi={eventi}
            pazienti={pazienti}
            onOpenPaziente={(p) => {
              setMissioneModal(null);
              setPazienteModal(p);
            }}
          />
        </Modal>
      )}

      {pazienteModal && (
        <Modal
          title={`Paziente ${pazienteModal.idPaziente}`}
          onClose={() => setPazienteModal(null)}
          scheda
        >
          <PazienteScheda
            evento={
              findEvento(eventi, pazienteModal.eventoIdUnivoco ?? pazienteModal.eventoCorrelato) ?? {
                _docId: '',
                idEvento: pazienteModal.eventoCorrelato || '?',
                idUnivoco: pazienteModal.eventoIdUnivoco || '',
                stato: false,
              }
            }
            paziente={pazienti.find((p) => p._docId === pazienteModal._docId) ?? pazienteModal}
            missioniEvento={missioniPerEvento(
              missioni,
              findEvento(eventi, pazienteModal.eventoIdUnivoco ?? pazienteModal.eventoCorrelato) ?? {
                idEvento: pazienteModal.eventoCorrelato,
              },
            )}
            allPazienti={pazienti}
            onClose={() => setPazienteModal(null)}
            onSaved={() => {}}
          />
        </Modal>
      )}
    </div>
  );
}
