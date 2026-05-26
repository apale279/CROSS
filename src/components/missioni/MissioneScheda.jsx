import { useCallback, useMemo } from 'react';
import { deleteField } from 'firebase/firestore';
import { Clock } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import {
  resolveCodiceColoreEvento,
  resolveCodiceColoreMissione,
  resolveCodiceColoreTrasporto,
  parseCodiceColoreOptional,
} from '../../lib/codiciColore';
import { ESITI_MISSIONE, ESITO_MISSIONE_DEFAULT, normalizeEsitoMissione } from '../../lib/missioneEsito';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { ColoreSelectButtons } from '../ui/ColoreSelectButtons';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { eventoColonnaIndirizzo } from '../../lib/eventoDisplay';
import { findEvento } from '../../lib/eventoLinks';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import { buildStatoChangeFields, patchStoricoStatoAt } from '../../lib/missionStoricoStati';
import {
  normalizeTratteMissione,
  nuovaTrattaMissione,
  tratteMissioneToFirestore,
} from '../../lib/missionTratte';
import { patchMissione } from '../../services/missioniService';
import { useElapsedSince } from '../../hooks/useElapsedSince';
import { statoMissioneBadgeClass, formatTimestamp } from '../../utils/formatters';
import {
  FormField,
  btnSecondary,
  btnDanger,
  inputClass,
  selectClass,
} from '../ui/FormField';
import { MissioneEccezioniPanel } from './MissioneEccezioniPanel';
import { MissionePazientiTrasportoSection } from './MissionePazientiTrasportoSection';
import { MissionePazienteRiferimentoSection } from './MissionePazienteRiferimentoSection';
import { MissionePmaInvioPsBadge } from './MissionePmaInvioPsBadge';
import {
  isMissionePmaInvioPs,
  ospedaleDestinazioneMissione,
} from '../../lib/pmaInvioPsMission';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { MissioneTelegramSendButton } from '../telegram/MissioneTelegramSendButton';
import { findMezzoBySigla } from '../../lib/mezzoMissione';
import { pazientiTrasportoPerMissione } from '../../lib/pazientiTrasportoQuery';

export function MissioneScheda({
  missione,
  eventi,
  mezzi,
  allMissioni,
  existingEventi,
  pazienti = [],
  onOpenEvento,
  onOpenPaziente,
  readOnly = false,
}) {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const stati = DEFAULT_IMPOSTAZIONI.statiMissione;
  const elapsed = useElapsedSince(missione.statoDa ?? missione.apertura);
  const storico = missione.storicoStati ?? {};
  const statoMissioneBloccato =
    missione.stato === 'FINE MISSIONE' || missione.stato === 'ANNULLATA';

  const evento = useMemo(
    () => findEvento(eventi, missione.eventoIdUnivoco || missione.eventoCorrelato),
    [eventi, missione],
  );
  const mezzo = useMemo(
    () => findMezzoBySigla(mezzi, missione.mezzo),
    [mezzi, missione.mezzo],
  );

  const pazientiTrasporto = useMemo(
    () => pazientiTrasportoPerMissione(pazienti, missione),
    [pazienti, missione],
  );

  const coloreM = useMemo(() => resolveCodiceColoreMissione(missione), [missione]);

  const coloreTrasportoEffettivo = useMemo(
    () => resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto),
    [missione, evento, pazientiTrasporto],
  );

  const tratte = useMemo(
    () => normalizeTratteMissione(missione.tratteMissione),
    [missione.tratteMissione],
  );

  const ospedaleDest = useMemo(
    () => ospedaleDestinazioneMissione(missione),
    [missione],
  );
  const missioneInvioPs = isMissionePmaInvioPs(missione);

  const persistTratte = useCallback(
    async (next) => {
      const sorted = [...next].sort((a, b) => a.quando.getTime() - b.quando.getTime());
      await patchMissione(
        manifestationId,
        missione._docId,
        { tratteMissione: tratteMissioneToFirestore(sorted) },
        missione.mezzo,
      );
    },
    [manifestationId, missione._docId, missione.mezzo],
  );

  const aggiungiTratta = async () => {
    await persistTratte([...tratte, nuovaTrattaMissione()]);
  };

  const onTrattaQuandoBlur = async (id, localValue) => {
    const date = fromDatetimeLocalValue(localValue);
    if (!date) return;
    const cur = tratte.find((t) => t.id === id);
    if (!cur) return;
    if (date.getTime() === cur.quando.getTime()) return;
    await persistTratte(tratte.map((t) => (t.id === id ? { ...t, quando: date } : t)));
  };

  const onTrattaDescrizioneBlur = async (id, value) => {
    const cur = tratte.find((t) => t.id === id);
    if (!cur || value === cur.descrizione) return;
    await persistTratte(tratte.map((t) => (t.id === id ? { ...t, descrizione: value } : t)));
  };

  const rimuoviTratta = async (id) => {
    if (tratte.length === 0) return;
    if (!window.confirm('Rimuovere questa tratta dalla missione?')) return;
    await persistTratte(tratte.filter((t) => t.id !== id));
  };

  const patchColoreMissione = async (colore) => {
    const valid = parseCodiceColoreOptional(colore);
    await patchMissione(
      manifestationId,
      missione._docId,
      valid
        ? { codiceColoreMissione: valid }
        : { codiceColoreMissione: deleteField() },
      missione.mezzo,
    );
  };

  const patchColoreTrasporto = async (colore) => {
    const valid = parseCodiceColoreOptional(colore);
    await patchMissione(
      manifestationId,
      missione._docId,
      valid
        ? { codiceColoreTrasporto: valid, codiceColoreTrasportoManuale: true }
        : {
            codiceColoreTrasporto: deleteField(),
            codiceColoreTrasportoManuale: deleteField(),
          },
      missione.mezzo,
    );
  };

  const patchEsitoMissione = async (esito, altro) => {
    const fields = { esitoMissione: normalizeEsitoMissione(esito) };
    if (fields.esitoMissione === 'ALTRO') {
      fields.esitoMissioneAltro = (altro ?? '').trim();
    } else {
      fields.esitoMissioneAltro = '';
    }
    await patchMissione(manifestationId, missione._docId, fields, missione.mezzo);
  };

  const impostaStatoOra = async (nuovo) => {
    if (statoMissioneBloccato && nuovo !== missione.stato) return;
    await patchMissione(
      manifestationId,
      missione._docId,
      buildStatoChangeFields(missione, nuovo),
      missione.mezzo,
    );
  };

  const onStoricoBlur = async (statoKey, localValue) => {
    const date = fromDatetimeLocalValue(localValue);
    const prev = toDatetimeLocalValue(storico[statoKey]);
    if (localValue === prev) return;
    await patchMissione(
      manifestationId,
      missione._docId,
      patchStoricoStatoAt(missione, statoKey, date),
      missione.mezzo,
    );
  };

  if (readOnly) {
    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <span className="font-mono text-xl font-bold text-slate-900">{missione.idMissione}</span>
          <MissionePmaInvioPsBadge missione={missione} className="text-xs" />
          <span
            className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${statoMissioneBadgeClass(missione.stato)}`}
          >
            {missione.stato}
          </span>
          <span className="font-mono text-xs text-slate-500">{elapsed}</span>
        </div>
        <dl className="grid gap-2">
          <Row label="Evento" value={missione.eventoCorrelato} mono />
          <Row label="Mezzo" value={missione.mezzo} mono />
          {(missioneInvioPs || ospedaleDest) && (
            <Row label="Ospedale destinazione" value={ospedaleDest || '—'} />
          )}
          <Row label="Apertura" value={formatTimestamp(missione.apertura)} />
          <Row label="Aperta" value={missione.aperta !== false ? 'Sì' : 'No'} />
          <Row label="Equipaggio" value={missione.equipaggio || '—'} />
        </dl>
        {missioneInvioPs && ospedaleDest && (
          <section className="rounded border border-violet-300 bg-violet-50 p-3">
            <p className="text-xs font-bold uppercase text-violet-900">Destinazione PS</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{ospedaleDest}</p>
          </section>
        )}
        <MissionePazienteRiferimentoSection
          riferimento={missione.pazienteRiferimento}
          onOpenPaziente={onOpenPaziente}
        />
        <MissionePazientiTrasportoSection
          pazienti={pazientiTrasporto}
          onOpenPaziente={onOpenPaziente}
        />
        {(missione.noteMissione ?? '').trim() ? (
          <section className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-600">Note missione</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{missione.noteMissione}</p>
          </section>
        ) : null}
        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase text-slate-600">Cronologia stati</p>
          <ul className="space-y-1">
            {stati.map((stato) => (
              <li key={stato} className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`font-bold uppercase ${
                    missione.stato === stato ? 'text-sky-800' : 'text-slate-600'
                  }`}
                >
                  {stato}
                </span>
                <span className="font-mono text-slate-500">
                  {formatTimestamp(
                    storico[stato] ??
                      (stato === missione.stato
                        ? missione.statoDa ?? missione.apertura
                        : null),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {tratte.length > 0 && (
          <section className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-600">Tratte / tappe</p>
            <ul className="space-y-2">
              {tratte.map((t) => (
                <li key={t.id} className="rounded border border-slate-200 bg-white p-2 text-sm">
                  <span className="font-mono text-xs text-slate-500">
                    {formatTimestamp(t.quando)}
                  </span>
                  <p className="text-slate-800">{t.descrizione || '—'}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {evento && (
          <section className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-600">Evento collegato</p>
            <p className="text-slate-800">{eventoColonnaIndirizzo(evento) || '—'}</p>
            <p className="text-slate-600">
              {evento.tipoEvento}
              {evento.dettaglioEvento ? ` — ${evento.dettaglioEvento}` : ''}
            </p>
            {onOpenEvento && (
              <button
                type="button"
                className={`${btnSecondary} mt-2`}
                onClick={() => onOpenEvento(evento)}
              >
                Apri scheda evento
              </button>
            )}
          </section>
        )}
        {mezzo && (
          <section className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-600">Mezzo</p>
            <p className="font-mono font-semibold">{mezzo.sigla ?? mezzo._docId}</p>
            <p>
              {mezzo.tipo} · {mezzo.statoMezzo ?? 'Disponibile'}
            </p>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
        <span className="font-mono text-xl font-bold text-slate-900">{missione.idMissione}</span>
        <MissionePmaInvioPsBadge missione={missione} className="text-xs" />
        <span
          className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${statoMissioneBadgeClass(missione.stato)}`}
        >
          {missione.stato}
        </span>
        <span className="font-mono text-xs text-slate-500">{elapsed}</span>
      </div>

      <dl className="grid gap-2">
        <Row label="Evento" value={missione.eventoCorrelato} mono />
        <Row label="Mezzo" value={missione.mezzo} mono />
        {(missioneInvioPs || ospedaleDest) && (
          <Row label="Ospedale destinazione" value={ospedaleDest || '—'} />
        )}
        <Row label="Apertura" value={formatTimestamp(missione.apertura)} />
        <Row label="Aperta" value={missione.aperta !== false ? 'Sì' : 'No'} />
        <Row label="Equipaggio" value={missione.equipaggio || '—'} />
      </dl>

      {missioneInvioPs && ospedaleDest && (
        <section className="rounded border border-violet-300 bg-violet-50 p-3">
          <p className="text-xs font-bold uppercase text-violet-900">Destinazione PS</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{ospedaleDest}</p>
        </section>
      )}

      <MissionePazienteRiferimentoSection
        riferimento={missione.pazienteRiferimento}
        onOpenPaziente={onOpenPaziente}
      />
      <MissionePazientiTrasportoSection
        pazienti={pazientiTrasporto}
        onOpenPaziente={onOpenPaziente}
      />

      <section className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="mb-3 text-xs font-bold uppercase text-slate-600">Codici colore</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-500">E — Evento</p>
            <ColoreIndicator colore={resolveCodiceColoreEvento(evento)} size="lg" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-500">M — Missione</p>
            <ColoreSelectButtons
              value={coloreM}
              onChange={(c) => void patchColoreMissione(c)}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-500">T — Trasporto</p>
            <p className="mb-1 text-[10px] text-slate-500">
              {coloreTrasportoEffettivo && !missione.codiceColoreTrasportoManuale
                ? 'Da pazienti in trasporto (MSB/MSA).'
                : 'Nessun colore finché non imposti T o carichi pazienti con codice sanitario.'}
            </p>
            <ColoreSelectButtons
              value={
                missione.codiceColoreTrasportoManuale
                  ? missione.codiceColoreTrasporto
                  : coloreTrasportoEffettivo
              }
              onChange={(c) => void patchColoreTrasporto(c)}
            />
            {missione.codiceColoreTrasportoManuale && (
              <p className="mt-1 text-[10px] text-slate-500">Impostato manualmente</p>
            )}
          </div>
        </div>
      </section>

      <FormField label="Esito missione">
        <select
          className={selectClass}
          value={normalizeEsitoMissione(missione.esitoMissione ?? ESITO_MISSIONE_DEFAULT)}
          onChange={(e) => void patchEsitoMissione(e.target.value, missione.esitoMissioneAltro)}
        >
          {ESITI_MISSIONE.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {normalizeEsitoMissione(missione.esitoMissione) === 'ALTRO' && (
          <textarea
            className={`${inputClass} mt-2`}
            rows={2}
            placeholder="Note esito"
            defaultValue={missione.esitoMissioneAltro ?? ''}
            onBlur={(e) => {
              const v = e.target.value;
              if (v === (missione.esitoMissioneAltro ?? '')) return;
              void patchEsitoMissione('ALTRO', v);
            }}
          />
        )}
      </FormField>

      <FormField label="Note missione">
        <textarea
          key={missione._docId}
          className={inputClass}
          rows={3}
          defaultValue={missione.noteMissione ?? ''}
          onBlur={async (e) => {
            const v = e.target.value;
            if (v === (missione.noteMissione ?? '')) return;
            await patchMissione(
              manifestationId,
              missione._docId,
              { noteMissione: v },
              missione.mezzo,
            );
          }}
        />
      </FormField>

      <MissioneEccezioniPanel
        manifestationId={manifestationId}
        missione={missione}
        eventi={eventi}
        mezzi={mezzi}
        allMissioni={allMissioni ?? []}
        existingEventi={existingEventi ?? eventi ?? []}
      />

      <section className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-bold uppercase text-slate-600">Cronologia stati</p>
        <p className="mb-3 text-[11px] text-slate-500">
          Usa l&apos;orologio accanto a uno stato per impostarlo subito con l&apos;orario attuale.
          {statoMissioneBloccato && ' Missione terminata: gli stati non sono più modificabili.'}
        </p>
        <ul className="space-y-2">
          {stati.map((stato) => {
            const isCurrent = missione.stato === stato;
            return (
              <li
                key={stato}
                className={`grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,auto)_1fr] sm:items-center ${
                  isCurrent ? 'rounded border border-sky-200 bg-sky-50/80 p-2' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold uppercase ${
                      isCurrent ? 'text-sky-800' : 'text-slate-600'
                    }`}
                  >
                    {stato}
                  </span>
                  <button
                    type="button"
                    disabled={statoMissioneBloccato}
                    className="inline-flex shrink-0 items-center justify-center rounded border border-slate-300 bg-white p-1 text-slate-600 shadow-sm hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      statoMissioneBloccato
                        ? 'Missione terminata'
                        : `Imposta stato «${stato}» adesso`
                    }
                    onClick={() => void impostaStatoOra(stato)}
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Imposta {stato} adesso</span>
                  </button>
                </div>
                <input
                  type="datetime-local"
                  className={`${inputClass} font-mono text-xs`}
                  value={toDatetimeLocalValue(
                    storico[stato] ??
                      (stato === missione.stato
                        ? missione.statoDa ?? missione.apertura
                        : null),
                  )}
                  onBlur={(e) => onStoricoBlur(stato, e.target.value)}
                  title="Modifica data/ora; al cambio stato viene impostata automaticamente"
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-slate-600">Tratte / tappe</p>
          <button type="button" className={btnSecondary} onClick={() => void aggiungiTratta()}>
            Aggiungi tratta
          </button>
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          Registra passaggi operativi con orario e descrizione (es. rientro in sede per rifornimento,
          sosta, cambio equipaggio). Non sostituiscono gli stati missione.
        </p>
        {tratte.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna tratta registrata.</p>
        ) : (
          <ul className="space-y-3">
            {tratte.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,auto)_1fr_auto] sm:items-start">
                  <FormField label="Data e ora" className="sm:min-w-[200px]">
                    <input
                      type="datetime-local"
                      className={`${inputClass} font-mono text-xs`}
                      defaultValue={toDatetimeLocalValue(t.quando)}
                      key={`${t.id}-${t.quando.getTime()}`}
                      onBlur={(e) => void onTrattaQuandoBlur(t.id, e.target.value)}
                    />
                  </FormField>
                  <FormField label="Descrizione">
                    <input
                      type="text"
                      className={inputClass}
                      defaultValue={t.descrizione}
                      placeholder="Es. Mezzo rientra in sede per rifornirsi"
                      onBlur={(e) => void onTrattaDescrizioneBlur(t.id, e.target.value)}
                    />
                  </FormField>
                  <div className="flex items-end sm:justify-end">
                    <button
                      type="button"
                      className={`${btnDanger} whitespace-nowrap`}
                      onClick={() => void rimuoviTratta(t.id)}
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {evento && (
        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase text-slate-600">Evento collegato</p>
          <p className="text-slate-800">{evento.indirizzo || '—'}</p>
          <p className="text-slate-600">
            {evento.tipoEvento}
            {evento.dettaglioEvento ? ` — ${evento.dettaglioEvento}` : ''}
          </p>
          <button type="button" className={`${btnSecondary} mt-2`} onClick={() => onOpenEvento?.(evento)}>
            Apri scheda evento
          </button>
        </section>
      )}

      {mezzo && (
        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase text-slate-600">Mezzo</p>
          <p className="font-mono font-semibold">{mezzo.sigla ?? mezzo._docId}</p>
          <p>
            {mezzo.tipo} · {mezzo.statoMezzo ?? 'Disponibile'}
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <MissioneTelegramSendButton
          missione={missione}
          evento={evento}
          eventi={eventi}
          telegramEnabled={telegramEnabled}
          className="px-3 py-2 text-xs"
        />
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`col-span-2 text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
