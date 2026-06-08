import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { Modal } from '../components/ui/Modal';
import { EventoScheda } from '../components/eventi/EventoScheda';
import { MissioneScheda } from '../components/missioni/MissioneScheda';
import { MezzoScheda } from '../components/mezzi/MezzoScheda';
import { PazienteScheda } from '../components/pazienti/PazienteScheda';
import { findEvento, missioniPerEvento } from '../lib/eventoLinks';

const KioskSchedaContext = createContext(null);

export function KioskSchedaProvider({ children }) {
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: pazienti } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: mezzi } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const [modal, setModal] = useState(null);
  const [pazienteModal, setPazienteModal] = useState(null);

  const closeModal = useCallback(() => setModal(null), []);

  const openEvento = useCallback((evento) => {
    if (!evento) return;
    setModal({ type: 'evento', data: evento });
  }, []);

  const openMissione = useCallback((missione) => {
    if (!missione) return;
    setModal({ type: 'missione', data: missione });
  }, []);

  const openMezzo = useCallback((mezzo) => {
    if (!mezzo) return;
    setModal({ type: 'mezzo', data: mezzo });
  }, []);

  const ctx = useMemo(
    () => ({ openEvento, openMissione, openMezzo, closeModal }),
    [openEvento, openMissione, openMezzo, closeModal],
  );

  const eventoLive =
    modal?.type === 'evento'
      ? eventi.find((e) => e._docId === modal.data._docId) ?? modal.data
      : null;

  const missioneLive =
    modal?.type === 'missione'
      ? missioni.find((m) => m._docId === modal.data._docId) ?? modal.data
      : null;

  const mezzoLive =
    modal?.type === 'mezzo'
      ? mezzi.find((m) => (m.sigla ?? m._docId) === (modal.data.sigla ?? modal.data._docId)) ??
        modal.data
      : null;

  const modalTitle =
    modal?.type === 'evento'
      ? `Evento ${eventoLive?.idEvento ?? ''} (sola lettura)`
      : modal?.type === 'missione'
        ? `Missione ${missioneLive?.idMissione ?? ''} (sola lettura)`
        : modal?.type === 'mezzo'
          ? `Mezzo ${mezzoLive?.sigla ?? mezzoLive?._docId ?? ''} (sola lettura)`
          : '';

  return (
    <KioskSchedaContext.Provider value={ctx}>
      {children}
      {modal && (
        <Modal title={modalTitle} onClose={closeModal} scheda>
          {modal.type === 'evento' && eventoLive && (
            <EventoScheda
              key={eventoLive._docId}
              readOnly
              evento={eventoLive}
              missioni={missioni}
              pazienti={pazienti}
              mezzi={mezzi}
              allMissioni={missioni}
              allPazienti={pazienti}
              existingEventi={eventi}
              onOpenMissione={openMissione}
            />
          )}
          {modal.type === 'missione' && missioneLive && (
            <MissioneScheda
              key={missioneLive._docId}
              readOnly
              missione={missioneLive}
              eventi={eventi}
              mezzi={mezzi}
              allMissioni={missioni}
              existingEventi={eventi}
              pazienti={pazienti}
              onOpenEvento={openEvento}
              onOpenPaziente={(p) => {
                setPazienteModal(pazienti.find((x) => x._docId === p._docId) ?? p);
              }}
            />
          )}
          {modal.type === 'mezzo' && mezzoLive && (
            <MezzoScheda readOnly mezzo={mezzoLive} />
          )}
        </Modal>
      )}
      {pazienteModal && (
        <Modal
          title={`Paziente ${pazienteModal.idPaziente ?? ''} (sola lettura)`}
          onClose={() => setPazienteModal(null)}
          wide
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
    </KioskSchedaContext.Provider>
  );
}

export function useKioskScheda() {
  const ctx = useContext(KioskSchedaContext);
  if (!ctx) {
    throw new Error('useKioskScheda va usato dentro KioskSchedaProvider');
  }
  return ctx;
}

/** In kiosk restituisce il context; fuori kiosk null (nessun errore). */
export function useKioskSchedaOptional() {
  return useContext(KioskSchedaContext);
}
