import { useEffect, useMemo, useState } from 'react';
import { TabelloneTattico } from '../tactical/TabelloneTattico';
import { MezziPilaSidebar } from '../tactical/MezziPilaSidebar';
import { MezzoScheda } from '../mezzi/MezzoScheda';
import { Modal } from '../ui/Modal';
import { selectClass } from '../ui/FormField';

export function MappaTatticaDashboard({ eventi, mezzi }) {
  const eventiConPiantina = useMemo(
    () => eventi.filter((e) => e.stato !== false && e.piantina_url),
    [eventi],
  );

  const [eventoDocId, setEventoDocId] = useState('');
  const [selectedMezzo, setSelectedMezzo] = useState(null);
  const [mezzoModal, setMezzoModal] = useState(null);

  useEffect(() => {
    if (!eventiConPiantina.length) {
      setEventoDocId('');
      return;
    }
    const stillValid = eventiConPiantina.some((e) => e._docId === eventoDocId);
    if (!stillValid) setEventoDocId(eventiConPiantina[0]._docId);
  }, [eventiConPiantina, eventoDocId]);

  const evento = eventiConPiantina.find((e) => e._docId === eventoDocId) ?? null;
  const selectedSigla = selectedMezzo ? (selectedMezzo.sigla ?? selectedMezzo._docId) : null;

  const liveMezzo = (m) =>
    mezzi.find((x) => (x.sigla ?? x._docId) === (m.sigla ?? m._docId)) ?? m;

  if (!eventiConPiantina.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-100 p-8 text-center">
        <p className="text-sm font-medium text-slate-800">Nessun evento con piantina</p>
        <p className="max-w-md text-sm text-slate-600">
          Apri un evento → tab <strong>Impostazioni evento</strong> → carica una piantina PNG. Poi
          torna qui per il tabellone tattico.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600">Evento</span>
          <select
            className={`${selectClass} min-w-[12rem]`}
            value={eventoDocId}
            onChange={(e) => {
              setEventoDocId(e.target.value);
              setSelectedMezzo(null);
            }}
          >
            {eventiConPiantina.map((ev) => (
              <option key={ev._docId} value={ev._docId}>
                {ev.idEvento} — {ev.tipoEvento || 'Evento'}
              </option>
            ))}
          </select>
        </label>
        {evento?.luogo_fisico && (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
            Luogo: {evento.luogo_fisico}
          </span>
        )}
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

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <TabelloneTattico
            piantinaUrl={evento?.piantina_url}
            mezzi={mezzi}
            selectedSigla={selectedSigla}
            onSelectMezzo={(m) => setSelectedMezzo(m)}
          />
        </div>
        <MezziPilaSidebar
          mezzi={mezzi}
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
