import { useEffect, useMemo, useRef } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { useManifestazioneCollection } from './useManifestazioneCollection';
import { useImpostazioni } from './useImpostazioni';
import {
  missioniPerEvento,
  pazientiPerEvento,
  eventoSenzaCoperturaMissione,
  sortEventiAperti,
} from '../lib/eventoLinks';
import { pazientiTrasportoPerMissione as pazientiTrasportoPerMissioneMatch } from '../lib/pazientiTrasportoQuery';
import { shouldAutoCloseEvento } from '../utils/eventoAutoClose';
import { patchEvento } from '../services/eventiService';

export function useOperativoDashboardData(options = {}) {
  const { autoReconcileOperativo = true } = options;
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);

  const eventiAperti = useMemo(() => sortEventiAperti(eventi), [eventi]);

  const pazientiCountByEvento = useMemo(() => {
    const m = new Map();
    for (const ev of eventiAperti) {
      m.set(ev._docId, pazientiPerEvento(pazienti, ev).length);
    }
    return m;
  }, [eventiAperti, pazienti]);

  const pazientiTrasportoByMissione = useMemo(() => {
    const m = new Map();
    for (const mis of missioni) {
      m.set(mis._docId, pazientiTrasportoPerMissioneMatch(pazienti, mis));
    }
    return m;
  }, [missioni, pazienti]);

  const missioniAperte = useMemo(() => missioni.filter((m) => m.aperta !== false), [missioni]);

  const sortMissioni = (list) =>
    list.slice().sort((a, b) => {
      const cmpM = String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it', {
        sensitivity: 'base',
      });
      if (cmpM !== 0) return cmpM;
      const mz = String(a.mezzo ?? '').localeCompare(String(b.mezzo ?? ''), 'it', {
        sensitivity: 'base',
      });
      if (mz !== 0) return mz;
      return (b.apertura?.toMillis?.() ?? 0) - (a.apertura?.toMillis?.() ?? 0);
    });

  const operativoBlocks = useMemo(() => {
    const usedMissionIds = new Set();
    const blocks = [];

    for (const ev of eventiAperti) {
      const missions = sortMissioni(missioniPerEvento(missioniAperte, ev));
      const missioniEvento = missioniPerEvento(missioni, ev);
      const pazientiEvento = pazientiPerEvento(pazienti, ev);
      const prontoOperativoTerminato =
        ev.operativoTerminato === true || shouldAutoCloseEvento(missioniEvento, pazientiEvento);
      missions.forEach((m) => usedMissionIds.add(m._docId));
      blocks.push({
        key: `ev-${ev._docId}`,
        ev,
        missions,
        prontoOperativoTerminato,
        orfano:
          ev.stato !== false &&
          !prontoOperativoTerminato &&
          eventoSenzaCoperturaMissione(missioni, ev),
      });
    }

    const orphans = sortMissioni(missioniAperte.filter((m) => !usedMissionIds.has(m._docId)));
    if (orphans.length) {
      blocks.push({ key: 'orphan-missions', ev: null, missions: orphans, orfano: false });
    }

    return blocks;
  }, [eventiAperti, missioniAperte, missioni, pazienti]);

  const reconciledOperativoRef = useRef(new Set());

  useEffect(() => {
    if (!autoReconcileOperativo || loadingE || loadingM || loadingP || !manifestationId) return;
    for (const ev of eventiAperti) {
      if (ev.operativoTerminato === true) continue;
      if (reconciledOperativoRef.current.has(ev._docId)) continue;
      const missioniEvento = missioniPerEvento(missioni, ev);
      const pazientiEvento = pazientiPerEvento(pazienti, ev);
      if (!shouldAutoCloseEvento(missioniEvento, pazientiEvento)) continue;
      reconciledOperativoRef.current.add(ev._docId);
      void patchEvento(manifestationId, ev._docId, {
        operativoTerminato: true,
        operativoTerminatoIl: serverTimestamp(),
      }).catch(() => {
        reconciledOperativoRef.current.delete(ev._docId);
      });
    }
  }, [eventiAperti, missioni, pazienti, manifestationId, loadingE, loadingM, loadingP, autoReconcileOperativo]);

  const operativoStats = useMemo(() => {
    const eventCount = operativoBlocks.filter((b) => b.ev).length;
    const missionCount = operativoBlocks.reduce((s, b) => s + b.missions.length, 0);
    return { eventCount, missionCount };
  }, [operativoBlocks]);

  const mezziSorted = useMemo(
    () =>
      [...mezzi].sort((a, b) =>
        (a.sigla ?? a._docId).localeCompare(b.sigla ?? b._docId),
      ),
    [mezzi],
  );

  const loading = loadingE || loadingM || loadingZ || loadingP;
  const stati = Array.isArray(impostazioni?.statiMissione) && impostazioni.statiMissione.length > 0
    ? impostazioni.statiMissione
    : DEFAULT_IMPOSTAZIONI.statiMissione;

  return {
    eventi,
    eventiAperti,
    missioni,
    mezzi,
    mezziSorted,
    operativoBlocks,
    operativoStats,
    pazientiCountByEvento,
    pazientiTrasportoByMissione,
    pazienti,
    loading,
    stati,
  };
}
