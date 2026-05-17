import { useMemo } from 'react';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from './useManifestazioneCollection';
import {
  missioniPerEvento,
  pazientiPerEvento,
  eventoSenzaCoperturaMissione,
} from '../lib/eventoLinks';

export function useOperativoDashboardData() {
  const { data: eventi, loading: loadingE } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni, loading: loadingM } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { data: mezzi, loading: loadingZ } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);

  const eventiAperti = useMemo(() => eventi.filter((e) => e.stato !== false), [eventi]);

  const pazientiCountByEvento = useMemo(() => {
    const m = new Map();
    for (const ev of eventiAperti) {
      m.set(ev._docId, pazientiPerEvento(pazienti, ev).length);
    }
    return m;
  }, [eventiAperti, pazienti]);

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
      missions.forEach((m) => usedMissionIds.add(m._docId));
      blocks.push({
        key: `ev-${ev._docId}`,
        ev,
        missions,
        orfano: ev.stato !== false && eventoSenzaCoperturaMissione(missioni, ev),
      });
    }

    const orphans = sortMissioni(missioniAperte.filter((m) => !usedMissionIds.has(m._docId)));
    if (orphans.length) {
      blocks.push({ key: 'orphan-missions', ev: null, missions: orphans, orfano: false });
    }

    const blockTime = (b) => {
      if (b.missions.length) return b.missions[0]?.apertura?.toMillis?.() ?? 0;
      return b.ev?.apertura?.toMillis?.() ?? 0;
    };
    blocks.sort((a, b) => blockTime(b) - blockTime(a));
    return blocks;
  }, [eventiAperti, missioniAperte, missioni]);

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
  const stati = DEFAULT_IMPOSTAZIONI.statiMissione;

  return {
    eventi,
    eventiAperti,
    missioni,
    mezzi,
    mezziSorted,
    operativoBlocks,
    operativoStats,
    pazientiCountByEvento,
    loading,
    stati,
  };
}
