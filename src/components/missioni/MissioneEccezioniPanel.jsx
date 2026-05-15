import { useMemo, useState } from 'react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { dettagliPerTipoEvento } from '../../lib/impostazioniNormalize';
import { findEvento } from '../../lib/eventoLinks';
import { MISSIONE_ECCEZIONE_MOTIVO } from '../../lib/missionEccezioni';
import {
  eseguiAvariaSinistroMissione,
  eseguiDirottamentoMissione,
  eseguiFlagDownMissione,
} from '../../services/missioniEccezioniService';
import { FormField, btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';
import { formatTimestamp } from '../../utils/formatters';

const LABEL_MOTIVO = {
  [MISSIONE_ECCEZIONE_MOTIVO.DIROTTAMENTO]: 'Dirottamento',
  [MISSIONE_ECCEZIONE_MOTIVO.FLAG_DOWN]: 'Intercettazione a vista (flag-down)',
  [MISSIONE_ECCEZIONE_MOTIVO.AVARIA_SINISTRO]: 'Avaria / sinistro in avvicinamento',
};

export function MissioneEccezioniPanel({
  manifestationId,
  missione,
  eventi,
  mezzi,
  allMissioni,
  existingEventi,
}) {
  const { impostazioni } = useImpostazioni();
  const terminata =
    missione.aperta === false ||
    missione.stato === 'ANNULLATA' ||
    missione.stato === 'FINE MISSIONE';

  const eventoCorrente = useMemo(
    () => findEvento(eventi, missione.eventoIdUnivoco || missione.eventoCorrelato),
    [eventi, missione],
  );
  const mezzoRecord = useMemo(
    () => mezzi.find((m) => (m.sigla ?? m._docId) === missione.mezzo),
    [mezzi, missione.mezzo],
  );

  const eventiDestinazione = useMemo(
    () => eventi.filter((e) => e.stato !== false && e._docId !== eventoCorrente?._docId),
    [eventi, eventoCorrente],
  );

  const [saving, setSaving] = useState(false);

  const [destDocId, setDestDocId] = useState('');
  const [noteDirott, setNoteDirott] = useState('');

  const [tipoFlag, setTipoFlag] = useState(DEFAULT_IMPOSTAZIONI.tipiEvento[0]);
  const [detFlag, setDetFlag] = useState('');
  const [colFlag, setColFlag] = useState('Rosso');
  const [indFlag, setIndFlag] = useState('');
  const [noteFlag, setNoteFlag] = useState('');
  const [noteAnnullaFlag, setNoteAnnullaFlag] = useState('');

  const [noteAvaria, setNoteAvaria] = useState('');

  const opzioniDettaglioFlag = useMemo(
    () => dettagliPerTipoEvento(impostazioni, tipoFlag),
    [impostazioni, tipoFlag],
  );

  const run = async (fn) => {
    setSaving(true);
    try {
      await fn();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDirottamento = () => {
    const ev = eventiDestinazione.find((e) => e._docId === destDocId);
    if (!ev) {
      alert('Seleziona un evento di destinazione aperto.');
      return;
    }
    if (!missione.mezzo) {
      alert('Missione senza mezzo assegnato.');
      return;
    }
    if (!window.confirm(`Annullare questa missione e assegnare il mezzo ${missione.mezzo} all’evento ${ev.idEvento}?`)) return;
    return run(() =>
      eseguiDirottamentoMissione({
        manifestationId,
        missione,
        eventoDestinazione: ev,
        allMissioni,
        mezzoRecord,
        note: noteDirott,
      }),
    );
  };

  const onFlagDown = () => {
    if (!eventoCorrente) {
      alert('Evento di origine non trovato.');
      return;
    }
    if (!indFlag.trim()) {
      alert('Indica almeno un indirizzo o punto di intervento per il nuovo evento.');
      return;
    }
    if (!window.confirm('Creare un nuovo evento (figlio), annullare la missione verso l’evento attuale e aprire missione IN POSTO sul nuovo intervento?')) return;
    return run(() =>
      eseguiFlagDownMissione({
        manifestationId,
        missione,
        eventoPadre: eventoCorrente,
        nuovoEventoFields: {
          tipoEvento: tipoFlag,
          dettaglioEvento: detFlag,
          colore: colFlag,
          indirizzo: indFlag.trim(),
          noteEvento: noteFlag.trim(),
        },
        existingEventi,
        allMissioni,
        mezzoRecord,
        noteAnnullamento: noteAnnullaFlag,
      }),
    );
  };

  const onAvaria = () => {
    if (!window.confirm('Annullare la missione, lasciare l’evento aperto e segnare il mezzo come non operativo (avaria/sinistro)?')) return;
    return run(() =>
      eseguiAvariaSinistroMissione({
        manifestationId,
        missione,
        note: noteAvaria,
      }),
    );
  };

  if (missione.stato === 'ANNULLATA' || missione.missioneEccezioneMotivo) {
    const m = missione.missioneEccezioneMotivo;
    return (
      <section className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="text-xs font-bold uppercase text-slate-600">Eccezione / annullamento</p>
        {m && (
          <p className="mt-2 text-slate-800">
            <span className="font-semibold">{LABEL_MOTIVO[m] ?? m}</span>
            {missione.missioneEccezioneNote ? ` — ${missione.missioneEccezioneNote}` : ''}
          </p>
        )}
        {!m && missione.stato === 'ANNULLATA' && (
          <p className="mt-2 text-slate-800 font-semibold">Missione annullata</p>
        )}
        {missione.missioneEccezioneIl && (
          <p className="mt-1 font-mono text-xs text-slate-500">
            {formatTimestamp(missione.missioneEccezioneIl)}
          </p>
        )}
      </section>
    );
  }

  if (terminata) return null;

  return (
    <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div>
        <h3 className="text-sm font-bold uppercase text-amber-900">Eccezioni operative</h3>
        <p className="mt-1 text-xs text-amber-950/80">
          Dirottamento su altro evento, intercettazione a vista (nuovo evento figlio), avaria/sinistro in avvicinamento.
          Per lo <strong>stand-down</strong> (richiesta annullata dal chiamante) usa la chiusura evento con tipo «Stand-down».
        </p>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase text-slate-700">1. Dirottamento (riassegnazione)</p>
        <p className="mb-2 text-[11px] text-slate-600">
          Annulla questa missione; l’evento attuale resta aperto (senza copertura finché non invii un altro mezzo). Il mezzo
          passa a una nuova missione sull’evento scelto.
        </p>
        <FormField label="Evento di destinazione">
          <select
            className={selectClass}
            value={destDocId}
            onChange={(e) => setDestDocId(e.target.value)}
          >
            <option value="">— Seleziona —</option>
            {eventiDestinazione.map((e) => (
              <option key={e._docId} value={e._docId}>
                {e.idEvento} · {e.tipoEvento} ({e.colore}) — {e.indirizzo?.slice(0, 48) || '—'}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Nota (opzionale)">
          <input
            className={inputClass}
            value={noteDirott}
            onChange={(e) => setNoteDirott(e.target.value)}
            placeholder="Es. priorità rosso su altro intervento"
          />
        </FormField>
        <button type="button" className={`${btnPrimary} mt-2`} disabled={saving} onClick={() => void onDirottamento()}>
          Esegui dirottamento
        </button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase text-slate-700">2. Intercettazione a vista (flag-down)</p>
        <p className="mb-2 text-[11px] text-slate-600">
          Crea un <strong>nuovo evento</strong> collegato come figlio all’evento attuale, annulla la missione in corso e apre
          missione <strong>IN POSTO</strong> sul nuovo intervento con lo stesso mezzo.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <FormField label="Tipo nuovo intervento">
            <select
              className={selectClass}
              value={tipoFlag}
              onChange={(e) => {
                const t = e.target.value;
                setTipoFlag(t);
                const opts = dettagliPerTipoEvento(impostazioni, t);
                setDetFlag(opts.includes(detFlag) ? detFlag : '');
              }}
            >
              {impostazioni.tipiEvento.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Codice colore">
            <select className={selectClass} value={colFlag} onChange={(e) => setColFlag(e.target.value)}>
              {DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Dettaglio">
          {opzioniDettaglioFlag.length > 0 ? (
            <select className={selectClass} value={detFlag} onChange={(e) => setDetFlag(e.target.value)}>
              <option value="">—</option>
              {opzioniDettaglioFlag.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input className={inputClass} value={detFlag} onChange={(e) => setDetFlag(e.target.value)} />
          )}
        </FormField>
        <FormField label="Indirizzo / luogo intervento">
          <input
            className={inputClass}
            value={indFlag}
            onChange={(e) => setIndFlag(e.target.value)}
            placeholder="Es. incrocio Via Roma — coordinate da aggiornare su scheda evento"
          />
        </FormField>
        <FormField label="Note nuovo evento">
          <input className={inputClass} value={noteFlag} onChange={(e) => setNoteFlag(e.target.value)} />
        </FormField>
        <FormField label="Nota annullamento missione precedente">
          <input
            className={inputClass}
            value={noteAnnullaFlag}
            onChange={(e) => setNoteAnnullaFlag(e.target.value)}
            placeholder="Es. intercettazione cittadini — arresto cardiaco"
          />
        </FormField>
        <button type="button" className={`${btnPrimary} mt-2`} disabled={saving} onClick={() => void onFlagDown()}>
          Crea evento figlio e missione IN POSTO
        </button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase text-slate-700">3. Avaria / sinistro in avvicinamento</p>
        <p className="mb-2 text-[11px] text-slate-600">
          Chiude la missione; l’evento resta aperto (invia un altro mezzo). Il mezzo viene segnato come{' '}
          <strong>non operativo (avaria/sinistro)</strong>.
        </p>
        <FormField label="Nota (consigliata)">
          <textarea
            className={inputClass}
            rows={2}
            value={noteAvaria}
            onChange={(e) => setNoteAvaria(e.target.value)}
            placeholder="Breve descrizione sinistro / avaria"
          />
        </FormField>
        <button type="button" className={`${btnSecondary} mt-2`} disabled={saving} onClick={() => void onAvaria()}>
          Registra avaria / sinistro
        </button>
      </div>
    </section>
  );
}
