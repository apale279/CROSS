import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTIONS } from '../../lib/firestorePaths';
import { getMezzoDeleteBlockReason } from '../../lib/mezzoDeleteGuard';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useManifestazioneCollection } from '../../hooks/useManifestazioneCollection';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  MEZZO_STATO_DISPONIBILE,
  MEZZO_STATO_NON_DISPONIBILE,
} from '../../lib/mezzoStati';
import { parseCoordinate } from '../../lib/googleMaps';
import {
  formatPosizioneRealeDisplay,
  mezzoPosizioneRealeCoordinate,
} from '../../lib/mezzoPosizione';
import { formatPercentPosition, mezzoOnTacticalBoard } from '../../lib/tacticalBoard';
import {
  findStazionamentoById,
  resolveMezzoStazionamentoId,
} from '../../lib/mezzoStazionamentoAssign';
import { deleteField } from 'firebase/firestore';
import { deleteMezzo, patchMezzo } from '../../services/mezziService';
import { patchMezzoStatoMezzo } from '../../services/mezzoDisponibileService';
import { missioniAperteSuMezzo } from '../../lib/mezzoMissione';
import { MISSION_PMA_CLOSE_MOTIVO } from '../../lib/missionPmaPatientClose';
import { confirmMezzoDisponibileLiberaMissioni } from '../../lib/mezzoDisponibileConfirm';
import { resolveMissionPmaPatientsBeforeClose } from '../../services/missionPmaPatientCloseService';
import { confirmDelete } from '../../utils/confirmDelete';
import { btnDanger, btnSecondary, inputClass } from '../ui/FormField';

/** Scheda mezzo (modale dashboard): dettaglio + modifica stato disponibilità. */
export function MezzoScheda({ mezzo, onDeleted, readOnly = false }) {
  const manifestationId = useManifestazioneId();
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: pazienti } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { impostazioni } = useImpostazioni();
  const gpsTrackingEnabled = impostazioni?.telegramGpsTrackingEnabled !== false;
  const [savingStato, setSavingStato] = useState(false);
  const [savingDettaglio, setSavingDettaglio] = useState(false);
  const [dettaglioDraft, setDettaglioDraft] = useState(mezzo?.dettaglio_stazionamento ?? '');

  useEffect(() => {
    setDettaglioDraft(mezzo?.dettaglio_stazionamento ?? '');
  }, [mezzo?.dettaglio_stazionamento, mezzo?.sigla, mezzo?._docId]);

  if (!mezzo) return null;

  const sigla = mezzo.sigla ?? mezzo._docId;
  const coord = parseCoordinate(mezzo.stazionamento?.coordinate);
  const posReale = mezzoPosizioneRealeCoordinate(mezzo);
  const posRealeLabel = formatPosizioneRealeDisplay(mezzo);
  const onBoard = mezzoOnTacticalBoard(mezzo);
  const posLabel = formatPercentPosition(mezzo.coordinate_stazionamento);
  const stato = mezzo.statoMezzo ?? MEZZO_STATO_DISPONIBILE;
  const stazionamenti = impostazioni?.stazionamenti ?? [];
  const sede = findStazionamentoById(
    resolveMezzoStazionamentoId(mezzo, stazionamenti),
    stazionamenti,
  );
  const sedeLabel = sede?.nome ?? '—';

  const setStatoMezzo = async (statoMezzo) => {
    if (statoMezzo === (mezzo.statoMezzo ?? MEZZO_STATO_DISPONIBILE)) return;
    if (!confirmMezzoDisponibileLiberaMissioni(missioni, sigla, statoMezzo)) return;
    if (statoMezzo === MEZZO_STATO_DISPONIBILE) {
      const aperte = missioniAperteSuMezzo(missioni, sigla);
      const { proceed } = await resolveMissionPmaPatientsBeforeClose({
        manifestationId,
        missioni: aperte,
        pazienti,
        eventi,
        motivoChiusura: MISSION_PMA_CLOSE_MOTIVO.MEZZO_DISPONIBILE,
        impostazioni,
        titolo: `Mezzo ${sigla} → DISPONIBILE`,
      });
      if (!proceed) return;
    }
    setSavingStato(true);
    try {
      await patchMezzoStatoMezzo(manifestationId, sigla, statoMezzo);
    } catch (err) {
      console.error(err);
      alert('Errore aggiornamento stato mezzo: ' + err.message);
    } finally {
      setSavingStato(false);
    }
  };

  const toggleSolamenteEsterno = async (checked) => {
    try {
      await patchMezzo(manifestationId, sigla, { solamente_esterno: checked });
    } catch (err) {
      console.error(err);
      alert('Errore: ' + err.message);
    }
  };

  const saveDettaglio = async () => {
    const next = dettaglioDraft.trim();
    if (next === (mezzo.dettaglio_stazionamento ?? '').trim()) return;
    setSavingDettaglio(true);
    try {
      await patchMezzo(manifestationId, sigla, { dettaglio_stazionamento: next });
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setSavingDettaglio(false);
    }
  };

  const clearTacticalPosition = async () => {
    if (!window.confirm('Rimuovere il mezzo dalla piantina tattica?')) return;
    await patchMezzo(manifestationId, sigla, { coordinate_stazionamento: deleteField() });
  };

  if (readOnly) {
    return (
      <dl className="space-y-3 text-sm">
        <Row label="Sigla" value={sigla} mono />
        <Row label="Tipo" value={mezzo.tipo} />
        <Row label="Targa" value={mezzo.targa || '—'} />
        <Row label="Radio" value={mezzo.radio || '—'} />
        <Row label="Sede (stazionamento)" value={sedeLabel} />
        <Row label="Stato mezzo" value={stato} />
        <Row label="Operativo" value={mezzo.operativo !== false ? 'Sì' : 'No'} />
        {mezzo.operativo === false && <Row label="Note" value={mezzo.noteOperativo || '—'} />}
        {onBoard ? (
          <>
            <Row label="Posizione tattica" value={posLabel ?? '—'} mono />
            <Row label="Dettaglio stazionamento" value={mezzo.dettaglio_stazionamento || '—'} />
          </>
        ) : (
          <>
            {mezzo.stazionamento?.luogo_fisico && (
              <Row label="Luogo fisico" value={mezzo.stazionamento.luogo_fisico} />
            )}
            <Row label="Stazionamento (indirizzo base)" value={mezzo.stazionamento?.indirizzo || '—'} />
            <Row label="Stazionamento operativo" value={mezzo.dettaglio_stazionamento || '—'} />
            <Row
              label="Coordinate"
              value={coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
            />
          </>
        )}
        <Row
          label="Solo esterno"
          value={mezzo.solamente_esterno === true ? 'Sì' : 'No'}
        />
        <PosizioneRealeRow
          coord={posReale}
          label={posRealeLabel}
          fonte={mezzo.posizioneReale?.fonte}
          trackingEnabled={gpsTrackingEnabled}
        />
        <EquipaggioList equipaggio={mezzo.equipaggio} />
      </dl>
    );
  }

  return (
    <dl className="space-y-3 text-sm">
      <Row label="Sigla" value={sigla} mono />
      <Row label="Tipo" value={mezzo.tipo} />
      <Row label="Targa" value={mezzo.targa || '—'} />
      <Row label="Radio" value={mezzo.radio || '—'} />
      <Row label="Sede (stazionamento)" value={sedeLabel} />
      <Row label="Stato mezzo">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={savingStato}
            onClick={() => void setStatoMezzo(MEZZO_STATO_DISPONIBILE)}
            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold uppercase ${
              stato === MEZZO_STATO_DISPONIBILE
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400'
            }`}
          >
            Disponibile
          </button>
          <button
            type="button"
            disabled={savingStato}
            onClick={() => void setStatoMezzo(MEZZO_STATO_NON_DISPONIBILE)}
            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold uppercase ${
              stato === MEZZO_STATO_NON_DISPONIBILE
                ? 'border-slate-600 bg-slate-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
            }`}
          >
            Non disponibile
          </button>
        </div>
        {savingStato && <span className="mt-1 block text-xs text-slate-500">Salvataggio…</span>}
        {stato !== MEZZO_STATO_DISPONIBILE && stato !== MEZZO_STATO_NON_DISPONIBILE && (
          <span className="mt-1 block text-xs text-amber-800">Stato da missione: {stato}</span>
        )}
      </Row>
      <Row label="Operativo" value={mezzo.operativo !== false ? 'Sì' : 'No'} />
      {mezzo.operativo === false && <Row label="Note" value={mezzo.noteOperativo || '—'} />}

      {onBoard ? (
        <>
          <Row label="Posizione tattica" value={posLabel ?? '—'} mono />
          <Row label="Dettaglio stazionamento">
            <input
              type="text"
              className={inputClass}
              value={dettaglioDraft}
              onChange={(e) => setDettaglioDraft(e.target.value)}
              onBlur={saveDettaglio}
              placeholder='es. "Cancello 3", "Sotto maxischermo"'
              disabled={savingDettaglio}
            />
            {savingDettaglio && (
              <span className="mt-1 block text-xs text-slate-500">Salvataggio…</span>
            )}
          </Row>
          <div>
            <button type="button" className={btnSecondary} onClick={clearTacticalPosition}>
              Rimuovi dalla piantina
            </button>
          </div>
        </>
      ) : (
        <>
          {mezzo.stazionamento?.luogo_fisico && (
            <Row label="Luogo fisico" value={mezzo.stazionamento.luogo_fisico} />
          )}
          <Row label="Stazionamento (indirizzo base)" value={mezzo.stazionamento?.indirizzo || '—'} />
          <Row label="Stazionamento operativo">
            <input
              type="text"
              className={inputClass}
              value={dettaglioDraft}
              onChange={(e) => setDettaglioDraft(e.target.value)}
              onBlur={saveDettaglio}
              placeholder='es. "Piazza Roma", "Cancello 3"'
              disabled={savingDettaglio}
            />
            <p className="mt-1 text-xs text-slate-500">
              Testo libero visibile in dashboard (senza creare uno stazionamento in Impostazioni).
            </p>
            {savingDettaglio && (
              <span className="mt-1 block text-xs text-slate-500">Salvataggio…</span>
            )}
          </Row>
          <Row
            label="Coordinate"
            value={coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
          />
        </>
      )}

      <PosizioneRealeRow
        coord={posReale}
        label={posRealeLabel}
        fonte={mezzo.posizioneReale?.fonte}
        trackingEnabled={gpsTrackingEnabled}
      />

      <EquipaggioList equipaggio={mezzo.equipaggio} />

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={mezzo.solamente_esterno === true}
          onChange={(e) => void toggleSolamenteEsterno(e.target.checked)}
        />
        <span>
          <span className="font-semibold">Mezzo solamente esterno</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Non compare nella pila mezzi della mappa tattica (solo supporto esterno).
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/mezzi" className={`${btnSecondary} inline-block text-center`}>
          Pagina mezzi
        </Link>
        <button
          type="button"
          className={btnDanger}
          onClick={async () => {
            const block = getMezzoDeleteBlockReason(sigla, missioni);
            if (block) {
              alert(block);
              return;
            }
            if (!confirmDelete(`mezzo ${sigla}`)) return;
            await deleteMezzo(manifestationId, sigla);
            onDeleted?.();
          }}
        >
          Elimina mezzo
        </button>
      </div>
    </dl>
  );
}

function Row({ label, value, mono, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className={`col-span-2 text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {children ?? value}
      </dd>
    </div>
  );
}

function PosizioneRealeRow({ coord, label, fonte, trackingEnabled = true }) {
  const mapsUrl = coord
    ? `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lng}`
    : null;
  return (
    <Row label="Posizione reale mezzo">
      {!trackingEnabled ? (
        <span className="text-slate-500">
          Tracking GPS disattivato in Impostazioni → Telegram. In mappa si usa lo stazionamento.
          {label ? (
            <span className="mt-1 block font-mono text-xs text-slate-400">
              Ultimo rilevamento (non aggiornato): {label}
            </span>
          ) : null}
        </span>
      ) : label ? (
        <span>
          <span className="font-mono">{label}</span>
          {fonte === 'telegram' && (
            <span className="mt-0.5 block text-xs text-slate-500">Da Telegram (GPS equipaggio)</span>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs font-medium text-sky-700 underline"
            >
              Apri su Google Maps
            </a>
          )}
        </span>
      ) : (
        <span className="text-slate-500">Non ancora ricevuta (da Telegram con GPS attivo)</span>
      )}
    </Row>
  );
}

function EquipaggioList({ equipaggio }) {
  if (!equipaggio) return null;
  const roles = [
    ['Autista', equipaggio.autista],
    ['Medico/CE', equipaggio.medico],
    ['Soccorritore 1', equipaggio.soccorritore1],
    ['Soccorritore 2', equipaggio.soccorritore2],
  ];
  return (
    <div>
      <p className="mb-1 font-medium text-slate-500">Equipaggio</p>
      <ul className="space-y-1 text-slate-800">
        {roles.map(([label, p]) => (
          <li key={label}>
            <span className="text-slate-500">{label}:</span>{' '}
            {[p?.nome, p?.cognome].filter(Boolean).join(' ') || '—'}
            {p?.telefono ? ` (${p.telefono})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
