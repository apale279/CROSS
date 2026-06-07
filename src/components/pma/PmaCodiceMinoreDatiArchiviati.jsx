import { useMemo } from 'react';
import { COLLECTIONS } from '../../lib/firestorePaths';
import { useManifestazioneCollection } from '../../hooks/useManifestazioneCollection';
import { findEvento, missioniPerEvento } from '../../lib/eventoLinks';
import { isPazienteOriginePma } from '../../lib/pmaModule';
import { isPercorsoCodiceMinoreTrasporto } from '../../lib/pmaDestinazioneTrasporto';
import { CODICE_COLORE_LABEL } from '../../pma/types/paziente';
import { PazienteModuloCentrale } from '../pazienti/moduli/PazienteModuloCentrale';
import { coloreSanitarioPazienteExport as pazienteColoreExport } from '../../lib/pazienteColoreExport';

/** Dati centrale / PMA clinico conservati dopo conversione a codice minore (sola lettura). */
export function PmaCodiceMinoreDatiArchiviati({ paziente, manifestationId }) {
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);

  const evento = useMemo(
    () => findEvento(eventi, paziente?.eventoIdUnivoco ?? paziente?.eventoCorrelato),
    [eventi, paziente],
  );

  const missioniEvento = useMemo(
    () => (evento ? missioniPerEvento(missioni, evento) : []),
    [missioni, evento],
  );

  if (!paziente) return null;

  const daCentrale =
    isPercorsoCodiceMinoreTrasporto(paziente) ||
    Boolean(paziente.eventoCorrelato || paziente.idMissione || paziente.eventoIdUnivoco);
  const autopresentato = isPazienteOriginePma(paziente);
  const scheda = paziente.pmaScheda ?? {};
  const haSchedaClinica =
    scheda &&
    Object.keys(scheda).some((k) => {
      const v = scheda[k];
      if (v == null || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });

  if (!daCentrale && !haSchedaClinica) return null;

  const colore = pazienteColoreExport(paziente);

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        I dati centrale, missione, valutazioni MSB/MSA e la scheda clinica PMA restano salvati sul
        documento paziente. Qui sotto puoi consultarli in sola lettura.
      </p>

      {daCentrale && manifestationId ? (
        <PazienteModuloCentrale
          manifestationId={manifestationId}
          patientDocId={paziente._docId}
          paziente={paziente}
          evento={evento}
          missioniEvento={missioniEvento}
        />
      ) : null}

      {(autopresentato || haSchedaClinica) && !daCentrale ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="mb-2 text-xs font-bold uppercase text-slate-600">Scheda PMA precedente</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {scheda.tipo_evento ? (
              <div>
                <dt className="text-xs text-slate-500">Tipo evento</dt>
                <dd>{scheda.tipo_evento}</dd>
              </div>
            ) : null}
            {scheda.dettaglio_evento ? (
              <div>
                <dt className="text-xs text-slate-500">Dettaglio</dt>
                <dd>{scheda.dettaglio_evento}</dd>
              </div>
            ) : null}
            {colore ? (
              <div>
                <dt className="text-xs text-slate-500">Codice colore</dt>
                <dd>{colore}</dd>
              </div>
            ) : null}
            {Array.isArray(scheda.parametri_vitali) && scheda.parametri_vitali.length > 0 ? (
              <div>
                <dt className="text-xs text-slate-500">Parametri vitali</dt>
                <dd>{scheda.parametri_vitali.length} rilevazioni</dd>
              </div>
            ) : null}
            {Array.isArray(scheda.farmaci) && scheda.farmaci.length > 0 ? (
              <div>
                <dt className="text-xs text-slate-500">Farmaci</dt>
                <dd>{scheda.farmaci.length} somministrazioni</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {daCentrale && haSchedaClinica ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Scheda clinica PMA: </span>
          {scheda.tipo_evento || scheda.dettaglio_evento
            ? `${scheda.tipo_evento ?? ''}${scheda.dettaglio_evento ? ` — ${scheda.dettaglio_evento}` : ''}`
            : 'presente'}
          {colore ? ` · Colore ${CODICE_COLORE_LABEL[scheda.codice_colore] ?? colore}` : ''}
          {Array.isArray(scheda.parametri_vitali) && scheda.parametri_vitali.length > 0
            ? ` · ${scheda.parametri_vitali.length} PV`
            : ''}
        </div>
      ) : null}
    </div>
  );
}
