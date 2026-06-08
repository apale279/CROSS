import { useEffect, useMemo, useState } from 'react';
import { useManifestazioneCollection } from '../../hooks/useManifestazioneCollection';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { COLLECTIONS } from '../../lib/firestorePaths';
import { listaOspedaliDestinazione } from '../../lib/destinazioniOspedale';
import { invioPsSoreuFieldsFromScheda } from '../../lib/invioPsSoreu';
import { missionePmaInvioPsApertaPerPaziente } from '../../lib/pmaInvioPsMission';
import { compareMezziDashboardSort } from '../../lib/mezzoStati';
import {
  isStatoMissioneRientroOLiberato,
  missioniAperteSuMezzo,
} from '../../lib/mezzoMissione';
import { createTrasportoInvioPsDaPma } from '../../services/pmaInvioPsTrasportoService';
import { useAuth } from '../../context/AuthContext';
import { operatoreCreatoFields } from '../../lib/operatoreAudit';
import { SoreuTrasportoFields } from './SoreuTrasportoFields';
import { FormField, btnPrimary, btnSecondary, selectClass } from '../ui/FormField';

/**
 * Dati missione SOREU per invio PS (118) + comando CREA TRASPORTO.
 * Utilizzabile anche su paziente dimesso: non modifica il paziente al click trasporto.
 */
export function InvioPsSoreuTrasportoBlock({
  manifestationId,
  paziente,
  pma,
  /** false se scheda sbloccata o in modifica; true = sola visione sui campi SOREU. */
  soreuReadOnly = false,
  onWriteSoreu,
  onOpenEvento,
  onOpenMissione,
  onOpenPazienteRiferimento,
}) {
  const { impostazioni } = useImpostazioni();
  const { user, profile } = useAuth();
  const { data: mezzi } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);

  const ospedali = useMemo(() => listaOspedaliDestinazione(impostazioni), [impostazioni]);

  const [mezzoSel, setMezzoSel] = useState('');
  const [ospedaleSel, setOspedaleSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);

  const soreuValues = useMemo(
    () => invioPsSoreuFieldsFromScheda(paziente?.pmaScheda ?? {}),
    [paziente?.pmaScheda],
  );

  useEffect(() => {
    const pre =
      String(paziente?.pmaScheda?.invio_ps_ospedale ?? paziente?.ospedaleDestinazione ?? '').trim();
    if (!pre) return;
    setOspedaleSel((cur) => (cur ? cur : pre));
    const inScheda = String(paziente?.pmaScheda?.invio_ps_ospedale ?? '').trim();
    if (!inScheda && pre && !soreuReadOnly) {
      void onWriteSoreu?.({ invio_ps_ospedale: pre });
    }
  }, [
    paziente?._docId,
    paziente?.pmaScheda?.invio_ps_ospedale,
    paziente?.ospedaleDestinazione,
    soreuReadOnly,
    onWriteSoreu,
  ]);

  const trasportoEsistente = useMemo(
    () => missionePmaInvioPsApertaPerPaziente(missioni, paziente?._docId),
    [missioni, paziente?._docId],
  );

  const mezziDisponibili = useMemo(
    () =>
      (mezzi ?? [])
        .filter((m) => Boolean(String(m?.sigla ?? m?._docId ?? '').trim()))
        .sort(compareMezziDashboardSort),
    [mezzi],
  );

  const mezzoInRientroLabel = useMemo(() => {
    if (!mezzoSel) return null;
    const open = missioniAperteSuMezzo(missioni, mezzoSel).filter((m) =>
      isStatoMissioneRientroOLiberato(m.stato),
    );
    if (open.length === 0) return null;
    const m = open[0];
    return `Mezzo in «${m.stato}» su missione ${m.idMissione ?? '—'}: alla creazione la missione in rientro verrà chiusa automaticamente.`;
  }, [mezzoSel, missioni]);

  if (!paziente || paziente?.pmaScheda?.dimissione_esito !== 'invio_ps') return null;

  const handleCreaTrasporto = async () => {
    if (!mezzoSel || !ospedaleSel || !manifestationId || !pma) return;
    setBusy(true);
    setError(null);
    try {
      const mezzoDoc = mezzi.find((m) => (m.sigla ?? m._docId) === mezzoSel);
      const result = await createTrasportoInvioPsDaPma(
        manifestationId,
        {
          paziente,
          pma,
          mezzo: mezzoSel,
          mezzoDoc,
          ospedaleDestinazione: ospedaleSel,
          eventi: eventi ?? [],
          missioni: missioni ?? [],
        },
        operatoreCreatoFields(user, profile),
      );
      setCreated(result);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-violet-200 pt-4">
      <p className="text-xs font-bold uppercase text-violet-900">
        Invio in PS — dati missione SOREU (118)
      </p>
      {soreuReadOnly ? (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Scheda in sola visione: usa <strong>Sblocca modifica</strong> in alto per aggiornare i dati
          SOREU. Il comando «CREA TRASPORTO» resta disponibile per i pazienti dimessi con invio PS.
        </p>
      ) : null}
      <SoreuTrasportoFields
        values={soreuValues}
        disabled={soreuReadOnly}
        onPatch={(partial) => {
          if (soreuReadOnly) return;
          void onWriteSoreu?.(partial);
        }}
      />

      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-700">Trasporto PMA → ospedale</p>
        <p className="mb-3 text-xs text-slate-600">
          Crea un evento/missione scollegati dal paziente (già dimesso). I dati anagrafici restano
          solo come riferimento sulla missione.
        </p>

        {created ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-teal-800">
              Trasporto creato: evento {created.evento.idEvento} · missione{' '}
              {created.missione.idMissione}
            </p>
            {created.ospedaleDestinazione && (
              <p className="text-sm text-teal-900">
                Destinazione: <strong>{created.ospedaleDestinazione}</strong>
              </p>
            )}
            <p className="text-xs text-slate-600">
              Il paziente dimesso resta scollegato: compare solo come riferimento sulla missione.
            </p>
            <div className="flex flex-wrap gap-2">
              {onOpenEvento && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => onOpenEvento(created.evento)}
                >
                  Apri evento
                </button>
              )}
              {onOpenMissione && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => onOpenMissione(created.missione)}
                >
                  Apri missione
                </button>
              )}
              {onOpenPazienteRiferimento && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => onOpenPazienteRiferimento(paziente)}
                >
                  Apri scheda paziente
                </button>
              )}
            </div>
          </div>
        ) : trasportoEsistente ? (
          <div className="space-y-2 text-sm">
            <p className="text-amber-900">
              Trasporto già aperto: missione{' '}
              <strong>{trasportoEsistente.idMissione ?? '—'}</strong> (evento{' '}
              {trasportoEsistente.eventoCorrelato ?? '—'}).
            </p>
            <div className="flex flex-wrap gap-2">
              {onOpenMissione && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() =>
                    onOpenMissione({
                      _docId: trasportoEsistente._docId,
                      idMissione: trasportoEsistente.idMissione,
                      idUnivoco: trasportoEsistente.idUnivoco,
                    })
                  }
                >
                  Apri missione trasporto
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <FormField label="Ospedale destinazione">
              <select
                className={selectClass}
                value={ospedaleSel}
                disabled={busy || soreuReadOnly}
                onChange={(e) => {
                  const v = e.target.value;
                  setOspedaleSel(v);
                  if (soreuReadOnly) return;
                  void onWriteSoreu?.({ invio_ps_ospedale: v });
                }}
              >
                <option value="">—</option>
                {ospedali.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </FormField>
            {ospedali.length === 0 && (
              <p className="text-xs text-amber-800">
                Nessun ospedale in impostazioni: aggiungili in Impostazioni → Lista ospedali.
              </p>
            )}
            <FormField label="Mezzo disponibile">
              <select
                className={selectClass}
                value={mezzoSel}
                disabled={busy}
                onChange={(e) => setMezzoSel(e.target.value)}
              >
                <option value="">—</option>
                {mezziDisponibili.map((m) => {
                  const sigla = m.sigla ?? m._docId;
                  return (
                    <option key={sigla} value={sigla}>
                      {sigla}
                      {m.tipo ? ` — ${m.tipo}` : ''}
                    </option>
                  );
                })}
              </select>
            </FormField>
            {mezzoInRientroLabel && (
              <p className="mt-1 text-xs text-amber-800">{mezzoInRientroLabel}</p>
            )}
            {mezziDisponibili.length === 0 && (
              <p className="mt-1 text-xs text-amber-800">Nessun mezzo disponibile al momento.</p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={`${btnPrimary} mt-3`}
              disabled={busy || !mezzoSel || !ospedaleSel}
              onClick={() => void handleCreaTrasporto()}
            >
              {busy ? 'Creazione…' : 'CREA TRASPORTO'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
