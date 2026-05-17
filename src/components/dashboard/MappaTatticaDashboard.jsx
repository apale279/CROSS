import { useCallback, useMemo, useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useEventoScheda } from '../../context/EventoSchedaContext';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { missioniPerEvento } from '../../lib/eventoLinks';
import { mezziConMissioneAttiva, isMissioneAttiva } from '../../lib/mezzoMissione';
import { buildStatoChangeFields } from '../../lib/missionStoricoStati';
import { patchMissione } from '../../services/missioniService';
import { TabelloneTattico } from '../tactical/TabelloneTattico';
import { MezziPilaSidebar } from '../tactical/MezziPilaSidebar';
import { EventiTatticaSidebar } from '../tactical/EventiTatticaSidebar';
import { MezzoScheda } from '../mezzi/MezzoScheda';
import { Modal } from '../ui/Modal';

export function MappaTatticaDashboard({ eventi, missioni, mezzi }) {
  const manifestationId = useManifestazioneId();
  const { impostazioni, loading: loadingImpostazioni } = useImpostazioni();
  const { openEventoScheda } = useEventoScheda();
  const piantinaUrl = impostazioni.piantina_url ?? null;

  const eventiAperti = useMemo(() => eventi.filter((e) => e.stato !== false), [eventi]);
  const mezziOccupati = useMemo(() => mezziConMissioneAttiva(missioni), [missioni]);

  const [eventoDocId, setEventoDocId] = useState('');
  const [selectedMezzo, setSelectedMezzo] = useState(null);
  const [mezzoModal, setMezzoModal] = useState(null);
  const [showRapidoForm, setShowRapidoForm] = useState(false);
  const [statoSaving, setStatoSaving] = useState(false);

  const evento =
    eventiAperti.find((e) => e._docId === eventoDocId) ??
    eventiAperti.find((e) => (e.luogo_fisico ?? '').trim()) ??
    null;

  const selectedSigla = selectedMezzo ? (selectedMezzo.sigla ?? selectedMezzo._docId) : null;

  const liveMezzo = (m) =>
    mezzi.find((x) => (x.sigla ?? x._docId) === (m.sigla ?? m._docId)) ?? m;

  const handleMissioneStato = useCallback(
    async (ev, nuovoStato) => {
      const attive = missioniPerEvento(missioni, ev).filter(isMissioneAttiva);
      if (!attive.length) return;
      setStatoSaving(true);
      try {
        await Promise.all(
          attive.map((mis) =>
            patchMissione(
              manifestationId,
              mis._docId,
              buildStatoChangeFields(mis, nuovoStato),
              mis.mezzo,
            ),
          ),
        );
      } catch (err) {
        alert('Errore: ' + err.message);
      } finally {
        setStatoSaving(false);
      }
    },
    [manifestationId, missioni],
  );

  if (!loadingImpostazioni && !piantinaUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-100 p-8 text-center">
        <p className="text-sm font-medium text-slate-800">Piantina non configurata</p>
        <p className="max-w-md text-sm text-slate-600">
          Vai in <strong>Impostazioni → Info luogo</strong> e incolla l&apos;URL della piantina.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {evento && (
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <span className="font-mono text-sm font-bold text-slate-900">{evento.idEvento}</span>
          <span className="text-sm text-slate-700">{(evento.luogo_fisico ?? '').trim()}</span>
          <span className="text-xs text-slate-500">
            {evento.tipoEvento}
            {evento.dettaglioEvento ? ` — ${evento.dettaglioEvento}` : ''}
          </span>
          {selectedMezzo && (
            <button
              type="button"
              className="ml-auto text-sm font-medium text-sky-700 hover:underline"
              onClick={() => setMezzoModal(liveMezzo(selectedMezzo))}
            >
              Scheda {selectedSigla}
            </button>
          )}
        </header>
      )}

      <div className="flex min-h-0 flex-1">
        <EventiTatticaSidebar
          eventi={eventi}
          missioni={missioni}
          mezzi={mezzi}
          selectedEventoDocId={evento?._docId ?? ''}
          showRapidoForm={showRapidoForm}
          onToggleRapidoForm={() => setShowRapidoForm((v) => !v)}
          onSelectEvento={(ev) => setEventoDocId(ev._docId)}
          onEventoRapidoCreated={({ docId }) => setEventoDocId(docId)}
          onOpenEventoScheda={openEventoScheda}
          onMissioneStato={handleMissioneStato}
          statoSaving={statoSaving}
        />
        <div className="relative min-h-0 min-w-0 flex-1">
          <TabelloneTattico
            piantinaUrl={piantinaUrl}
            eventi={eventiAperti}
            mezzi={mezzi}
            mezziOccupati={mezziOccupati}
            selectedEventoDocId={evento?._docId ?? ''}
            selectedSigla={selectedSigla}
            onSelectEvento={(ev) => setEventoDocId(ev._docId)}
            onSelectMezzo={(m) => {
              const live = liveMezzo(m);
              setSelectedMezzo(live);
              setMezzoModal(live);
            }}
          />
        </div>
        <MezziPilaSidebar
          mezzi={mezzi}
          mezziOccupati={mezziOccupati}
          selectedSigla={selectedSigla}
          onSelect={(m) => setSelectedMezzo(m)}
        />
      </div>

      {mezzoModal && (
        <Modal
          title={`Mezzo ${mezzoModal.sigla ?? mezzoModal._docId}`}
          onClose={() => setMezzoModal(null)}
        >
          <MezzoScheda
            mezzo={liveMezzo(mezzoModal)}
            onDeleted={() => {
              setMezzoModal(null);
              setSelectedMezzo(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
