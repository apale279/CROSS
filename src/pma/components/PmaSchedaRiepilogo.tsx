import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../cross/firebase';
import { pazienteValutazioniSoccorsoPathSegments } from '../../lib/firestorePaths';
import { normalizeValutazioniSoccorso } from '../../lib/pazienteValutazioniSoccorso';
import { formatTimestamp } from '../../utils/formatters';
import { TIPO_PZ } from '../../lib/pmaModule';
import { PazienteAnagraficaFields } from '../../components/pazienti/PazienteAnagraficaFields';
import { PazienteTipoEventoFields } from '../../components/pazienti/PazienteTipoEventoFields';
import type { Paziente } from '@pma/types/paziente';

type RawDoc = Record<string, unknown> & { _docId?: string };

type Props = {
  rawDoc: RawDoc;
  p: Paziente;
  impostazioni: Record<string, unknown> | null;
  eventoLabel?: string;
  eventoTipo?: string;
  eventoDettaglio?: string;
  manifestationId: string;
  canEdit: boolean;
  write?: (patch: Record<string, unknown>) => Promise<void>;
};

export function PmaSchedaRiepilogo({
  rawDoc,
  p,
  impostazioni,
  eventoLabel,
  eventoTipo,
  eventoDettaglio,
  manifestationId,
  canEdit,
  write,
}: Props) {
  const [valutazioni, setValutazioni] = useState<ReturnType<typeof normalizeValutazioniSoccorso>>([]);
  const [anagDraft, setAnagDraft] = useState({
    nome: p.nome ?? '',
    cognome: p.cognome ?? '',
    pettorale: p.pettorale != null ? String(p.pettorale) : '',
    telefono: p.telefono ?? '',
    comune: String(rawDoc.comune ?? ''),
    indirizzo: String(rawDoc.indirizzo ?? ''),
    dataNascita: String(rawDoc.dataNascita ?? '').slice(0, 10),
    eta: p.eta != null ? String(p.eta) : '',
    sesso: String(rawDoc.sesso ?? ''),
    notePaziente: p.note_centrale ?? '',
  });
  const [tipoEv, setTipoEv] = useState(p.tipo_evento || eventoTipo || '');
  const [dettaglioEv, setDettaglioEv] = useState(p.dettaglio_evento || eventoDettaglio || '');

  const docId = String(rawDoc._docId ?? '');
  const isAutopresentato = rawDoc.tipoPz === TIPO_PZ.PMA;
  const anagraficaEditable = Boolean(canEdit && isAutopresentato && write);
  const eventoEditable = Boolean(canEdit && isAutopresentato && write);

  useEffect(() => {
    setAnagDraft({
      nome: p.nome ?? '',
      cognome: p.cognome ?? '',
      pettorale: p.pettorale != null ? String(p.pettorale) : '',
      telefono: p.telefono ?? '',
      comune: String(rawDoc.comune ?? ''),
      indirizzo: String(rawDoc.indirizzo ?? ''),
      dataNascita: String(rawDoc.dataNascita ?? '').slice(0, 10),
      eta: p.eta != null ? String(p.eta) : '',
      sesso: String(rawDoc.sesso ?? ''),
      notePaziente: p.note_centrale ?? '',
    });
    setTipoEv(p.tipo_evento || eventoTipo || '');
    setDettaglioEv(p.dettaglio_evento || eventoDettaglio || '');
  }, [p.id, p.nome, p.cognome, p.tipo_evento, p.dettaglio_evento, eventoTipo, eventoDettaglio, rawDoc.comune, rawDoc.indirizzo, rawDoc.dataNascita, rawDoc.sesso]);

  useEffect(() => {
    if (!manifestationId || !docId) return undefined;
    const ref = collection(
      db,
      ...pazienteValutazioniSoccorsoPathSegments(manifestationId, docId),
    );
    const unsub = onSnapshot(ref, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setValutazioni(normalizeValutazioniSoccorso(rows));
    });
    return () => unsub();
  }, [manifestationId, docId]);

  const flushAnagrafica = async (draft: typeof anagDraft) => {
    if (!write) return;
    await write({
      nome: draft.nome.trim(),
      cognome: draft.cognome.trim(),
      pettorale: draft.pettorale === '' ? null : Number(draft.pettorale),
      telefono: draft.telefono.trim(),
      comune: draft.comune.trim(),
      indirizzo: draft.indirizzo.trim(),
      dataNascita: draft.dataNascita.trim(),
      sesso: draft.sesso.trim(),
      note_centrale: draft.notePaziente.trim(),
      ...(draft.eta !== '' ? { eta: Number(draft.eta) } : { eta: null }),
    });
  };

  const flushEvento = async (tipo: string, dettaglio: string) => {
    if (!write) return;
    await write({ tipo_evento: tipo.trim(), dettaglio_evento: dettaglio.trim() });
  };

  return (
    <section className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
          {isAutopresentato ? 'Paziente autopresentato' : 'Dati da centrale'}
        </p>
        <span className="font-mono text-xs text-slate-500">{p.id_paziente_visibile}</span>
      </div>

      {!isAutopresentato && eventoLabel && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">Evento correlato: </span>
          <span className="font-mono">{eventoLabel}</span>
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Anagrafica</p>
        {anagraficaEditable ? (
          <PazienteAnagraficaFields
            draft={anagDraft}
            onChange={(key, value) => setAnagDraft((d) => ({ ...d, [key]: value }))}
            onBlurField={(key, value) => {
              const next =
                value !== undefined ? { ...anagDraft, [key]: value } : anagDraft;
              void flushAnagrafica(next);
            }}
          />
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Cognome / nome</dt>
              <dd className="font-medium">
                {[p.cognome, p.nome].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Pettorale</dt>
              <dd>{p.pettorale ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Telefono</dt>
              <dd>{p.telefono || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Comune</dt>
              <dd>{String(rawDoc.comune ?? '').trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Indirizzo</dt>
              <dd>{String(rawDoc.indirizzo ?? '').trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Data di nascita</dt>
              <dd>{String(rawDoc.dataNascita ?? '').slice(0, 10) || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Età</dt>
              <dd>{p.eta ?? '—'}</dd>
            </div>
            {p.note_centrale && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Note</dt>
                <dd className="whitespace-pre-wrap">{p.note_centrale}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Tipo e dettaglio evento</p>
        {eventoEditable ? (
          <PazienteTipoEventoFields
            impostazioni={impostazioni}
            tipoEvento={tipoEv}
            dettaglioEvento={dettaglioEv}
            onChange={(partial) => {
              const nextTipo = partial.tipoEvento ?? tipoEv;
              const nextDet = partial.dettaglioEvento ?? dettaglioEv;
              setTipoEv(nextTipo);
              setDettaglioEv(nextDet);
              void flushEvento(nextTipo, nextDet);
            }}
          />
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Tipo evento</dt>
              <dd>{tipoEv || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dettaglio evento</dt>
              <dd>{dettaglioEv || '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {valutazioni.length > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-bold uppercase text-slate-600">
            Valutazioni mezzi di soccorso
          </p>
          <ul className="space-y-2">
            {valutazioni.map((v) => (
              <li
                key={v.id}
                className={`rounded border px-3 py-2 text-sm ${
                  v.tipo === 'MSA'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-teal-200 bg-teal-50'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      v.tipo === 'MSA'
                        ? 'bg-violet-200 text-violet-900'
                        : 'bg-teal-200 text-teal-900'
                    }`}
                  >
                    {v.tipo}
                  </span>
                  <span className="text-xs text-slate-500">{formatTimestamp(v.creatoIl)}</span>
                </div>
                {v.testo && <p className="whitespace-pre-wrap text-slate-800">{v.testo}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
