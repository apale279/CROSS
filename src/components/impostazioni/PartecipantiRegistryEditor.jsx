import { useRef, useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useRegistryPartecipanti } from '../../hooks/useRegistryPartecipanti';
import { parseExcelPartecipanti } from '../../lib/excelPartecipanti';
import {
  clearRegistryPartecipanti,
  replaceRegistryPartecipanti,
} from '../../services/registryPartecipantiService';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { btnPrimary, btnSecondary } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function PartecipantiRegistryEditor() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const { registryPartecipanti, loadingRegistry } = useRegistryPartecipanti(
    impostazioni.registryPartecipanti ?? [],
  );
  const list = registryPartecipanti;
  const inputRef = useRef(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      alert('Seleziona un file Excel (.xlsx o .xls).');
      e.target.value = '';
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseExcelPartecipanti(buf);
      if (parsed.length === 0) {
        alert(
          'Nessuna riga valida: verifica colonne A=pettorale, B=nome, C=cognome, D=data di nascita, E=tel.',
        );
        return;
      }
      await replaceRegistryPartecipanti(manifestationId, parsed);
      setFeedback(`Caricati ${parsed.length} partecipanti (Firestore, un doc per pettorale).`);
    } catch (err) {
      console.error(err);
      alert('Errore lettura file: ' + (err?.message ?? err));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const clearRegistry = async () => {
    if (!window.confirm('Rimuovere tutti i partecipanti caricati dall’Excel?')) return;
    setFeedback('');
    try {
      await clearRegistryPartecipanti(manifestationId);
      setFeedback('Anagrafica gara vuota.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  if (loadingRegistry && list.length === 0 && !busy) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento registry partecipanti…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold uppercase text-slate-800">
          Registry partecipanti (Excel gara)
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Colonne nella prima pagina—ordine fisso:&nbsp;
          <strong>A</strong> numero pettorale, <strong>B</strong> nome, <strong>C</strong> cognome,{' '}
          <strong>D</strong> data di nascita, <strong>E</strong> telefono. Prima riga con intestazioni
          testuali sul pettorale viene ignorata.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Lettura…' : 'Carica Excel (.xlsx)'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onFile}
        />
        {list.length > 0 && (
          <button type="button" className={btnSecondary} disabled={busy} onClick={clearRegistry}>
            Svuota registry
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Partecipanti in Firestore (sotto-collezione): <strong>{list.length}</strong>
      </p>
      <div className="mt-3">
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
      </div>
    </section>
  );
}
