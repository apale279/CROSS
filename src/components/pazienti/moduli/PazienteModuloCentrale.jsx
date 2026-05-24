import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { ESITO_TRASPORTA } from '../../../constants';
import { pazienteValutazioniSoccorsoPathSegments } from '../../../lib/firestorePaths';
import { normalizeValutazioniSoccorso } from '../../../lib/pazienteValutazioniSoccorso';
import { formatTimestamp } from '../../../utils/formatters';
import { MsbValutazioneForm } from '../MsbValutazioneForm';
import { MsaValutazioneForm } from '../MsaValutazioneForm';
import { SoreuTrasportoFields } from '../SoreuTrasportoFields';
import { destinazioneRichiedeSoreu, soreuFieldsFromPatient } from '../../../lib/soreuTrasporto';
import { useImpostazioni } from '../../../hooks/useImpostazioni';

/**
 * Modulo soccorso/centrale in sola lettura (per scheda PMA su pazienti inviati da centrale).
 */
export function PazienteModuloCentrale({
  manifestationId,
  patientDocId,
  paziente,
  evento,
  missioniEvento = [],
}) {
  const { impostazioni } = useImpostazioni();
  const [valutazioni, setValutazioni] = useState([]);

  useEffect(() => {
    if (!manifestationId || !patientDocId) return undefined;
    const ref = collection(
      db,
      ...pazienteValutazioniSoccorsoPathSegments(manifestationId, patientDocId),
    );
    const unsub = onSnapshot(ref, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setValutazioni(normalizeValutazioniSoccorso(rows));
    });
    return () => unsub();
  }, [manifestationId, patientDocId]);

  if (!paziente) return null;

  const soreu = soreuFieldsFromPatient(paziente);
  const trasporta = paziente.esito === ESITO_TRASPORTA;
  const mostraSoreu = trasporta && destinazioneRichiedeSoreu(paziente, impostazioni);
  const mezzi = [
    ...new Set(
      (missioniEvento ?? []).map((m) => m.mezzo).filter(Boolean),
    ),
  ];

  return (
    <section className="mb-6 space-y-4 rounded-lg border border-teal-200 bg-teal-50/30 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-teal-900">
        Modulo soccorso (centrale)
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Evento correlato</dt>
          <dd className="font-mono font-semibold">{evento?.idEvento ?? paziente.eventoCorrelato ?? '—'}</dd>
        </div>
        {paziente.idMissione && (
          <div>
            <dt className="text-xs font-medium text-slate-500">ID missione</dt>
            <dd className="font-mono">{paziente.idMissione}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-slate-500">Creato</dt>
          <dd>{formatTimestamp(paziente.apertura)}</dd>
        </div>
        {paziente.stato === 'ARRIVATO H' && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Arrivato in H</dt>
            <dd>{formatTimestamp(paziente.arrivatoHAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-slate-500">Stato centrale</dt>
          <dd className="font-semibold">{paziente.stato ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Esito</dt>
          <dd>{paziente.esito || '—'}{paziente.esitoAltro ? ` — ${paziente.esitoAltro}` : ''}</dd>
        </div>
        {trasporta && (
          <>
            <div>
              <dt className="text-xs font-medium text-slate-500">Mezzo</dt>
              <dd className="font-mono">{paziente.mezzo || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Destinazione</dt>
              <dd>{paziente.ospedaleDestinazione || '—'}</dd>
            </div>
          </>
        )}
      </dl>

      {mostraSoreu && paziente.ospedaleDestinazione && (
        <div className="pointer-events-none opacity-90">
          <SoreuTrasportoFields values={soreu} onPatch={() => {}} />
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">
          Valutazioni mezzi di soccorso
        </p>
        {valutazioni.length === 0 ? (
          <p className="text-xs text-slate-500">Nessuna valutazione registrata.</p>
        ) : (
          <ul className="space-y-3">
            {valutazioni.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-teal-200/80 bg-white p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-900">
                    {v.tipo === 'MSA' ? 'MSA' : 'MSB'}
                  </span>
                  {v.creatoIl && (
                    <span className="text-[10px] text-slate-500">
                      {formatTimestamp(v.creatoIl)}
                    </span>
                  )}
                </div>
                {v.tipo === 'MSB' ? (
                  <div className="pointer-events-none opacity-95">
                    <MsbValutazioneForm
                      valuationId={v.id}
                      msbDetails={v.msbDetails}
                      mezziEventoSigle={mezzi}
                      onPatch={() => {}}
                    />
                  </div>
                ) : (
                  <div className="pointer-events-none opacity-95">
                    <MsaValutazioneForm
                      valuationId={v.id}
                      msaDetails={v.msaDetails}
                      creatoIl={v.creatoIl}
                      mezziEventoSigle={mezzi}
                      onPatchDetails={() => {}}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
