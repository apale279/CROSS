import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  COLLECTIONS,
} from '../lib/firestorePaths';
import { findEvento } from '../lib/eventoLinks';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { Modal } from '../components/ui/Modal';
import { EventoScheda } from '../components/eventi/EventoScheda';

const EventoSchedaContext = createContext(null);

export function EventoSchedaProvider({ children }) {
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: pazienti } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: mezzi } = useManifestazioneCollection(COLLECTIONS.mezzi);

  const [modal, setModal] = useState(null);
  const [pendingDocId, setPendingDocId] = useState(null);

  useEffect(() => {
    if (!pendingDocId) return;
    const found = eventi.find((e) => e._docId === pendingDocId);
    if (found) {
      setModal((m) => ({ evento: found, initialTab: m?.initialTab ?? 'missioni' }));
      setPendingDocId(null);
    }
  }, [eventi, pendingDocId]);

  const handleCreated = useCallback(
    ({ docId, idEvento, idUnivoco }) => {
      const found = eventi.find((e) => e._docId === docId);
      if (found) {
        setModal({ evento: found, initialTab: 'missioni' });
        return;
      }
      setModal({
        evento: {
          _docId: docId,
          idEvento,
          idUnivoco,
          stato: true,
        },
        initialTab: 'missioni',
      });
      setPendingDocId(docId);
    },
    [eventi],
  );

  const openNuovoEvento = useCallback(() => setModal({ evento: null }), []);

  const openEventoScheda = useCallback(
    (eventoOrId) => {
      if (!eventoOrId) return;
      if (typeof eventoOrId === 'object') {
        const live =
          eventi.find((e) => e._docId === eventoOrId._docId) ??
          findEvento(eventi, eventoOrId.idUnivoco ?? eventoOrId.idEvento) ??
          eventoOrId;
        setModal({ evento: live });
        return;
      }
      const found = findEvento(eventi, eventoOrId);
      if (found) setModal({ evento: found });
      else {
        alert(
          'Evento non trovato nell\'elenco corrente. Attendi il caricamento dei dati o verifica che non sia stato eliminato.',
        );
      }
    },
    [eventi],
  );

  const closeModal = useCallback(() => {
    setModal(null);
    setPendingDocId(null);
  }, []);

  const eventoLive = modal?.evento
    ? eventi.find((e) => e._docId === modal.evento._docId) ?? modal.evento
    : null;

  const title = modal
    ? eventoLive
      ? `Evento ${eventoLive.idEvento}`
      : 'Nuovo evento'
    : '';

  return (
    <EventoSchedaContext.Provider value={{ openNuovoEvento, openEventoScheda, closeModal }}>
      {children}
      {modal && (
        <Modal title={title} onClose={closeModal} scheda>
          <EventoScheda
            key={eventoLive?._docId ?? 'nuovo'}
            evento={eventoLive}
            missioni={missioni}
            pazienti={pazienti}
            mezzi={mezzi}
            allMissioni={missioni}
            allPazienti={pazienti}
            existingEventi={eventi}
            initialTab={modal.initialTab}
            onCreated={handleCreated}
            onDeleted={closeModal}
            onArchived={closeModal}
          />
        </Modal>
      )}
    </EventoSchedaContext.Provider>
  );
}

export function useEventoScheda() {
  const ctx = useContext(EventoSchedaContext);
  if (!ctx) throw new Error('useEventoScheda va usato dentro EventoSchedaProvider');
  return ctx;
}
