import { useState } from 'react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { formatTimeOnly, statoMissioneBadgeClass } from '../utils/formatters';
import { MissioneTelegramSendButton } from '../components/telegram/MissioneTelegramSendButton';
import { findEventoForMissione } from '../lib/telegramMissionPayload';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { Modal } from '../components/ui/Modal';

export default function MissioniPage() {
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { impostazioni } = useImpostazioni();
  const [missioneModal, setMissioneModal] = useState(null);

  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const loading = loadingM || loadingE || loadingZ;

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
                    <td className={`${tdClass} font-mono font-bold`}>{row.idMissione}</td>
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
        >
          <MissioneScheda
            missione={
              missioni.find((m) => m._docId === missioneModal._docId) ?? missioneModal
            }
            eventi={eventi}
            mezzi={mezzi}
            allMissioni={missioni}
            existingEventi={eventi}
          />
        </Modal>
      )}
    </div>
  );
}
