import { collection, getDocs } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import { db } from '../firebaseConfig';
import {
  buildCsvFromRows,
  docToExportRow,
  serializeForExport,
} from '../lib/firestoreCsvExport';
import {
  eventiPath,
  mezziPath,
  missioniPath,
  pazientiPath,
  pazienteValutazioniSoccorsoPathSegments,
} from '../lib/firestorePaths';

function exportTimestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function downloadCsv(filename, csvText) {
  saveAs(new Blob([csvText], { type: 'text/csv;charset=utf-8' }), filename);
}

/**
 * Esporta EVENTI, MISSIONI, MEZZI, PAZIENTI (con pmaScheda/cartella e valutazioni soccorso) in CSV.
 */
export async function exportOpsDataCsv(manifestationId) {
  const ts = exportTimestamp();
  const [eventiSnap, missioniSnap, mezziSnap, pazientiSnap] = await Promise.all([
    getDocs(collection(db, ...eventiPath(manifestationId))),
    getDocs(collection(db, ...missioniPath(manifestationId))),
    getDocs(collection(db, ...mezziPath(manifestationId))),
    getDocs(collection(db, ...pazientiPath(manifestationId))),
  ]);

  const eventiRows = eventiSnap.docs.map((d) => docToExportRow(d.id, d.data()));
  const missioniRows = missioniSnap.docs.map((d) => docToExportRow(d.id, d.data()));
  const mezziRows = mezziSnap.docs.map((d) => docToExportRow(d.id, d.data()));

  const pazientiRows = [];
  for (const d of pazientiSnap.docs) {
    const valSnap = await getDocs(
      collection(db, ...pazienteValutazioniSoccorsoPathSegments(manifestationId, d.id)),
    );
    const valutazioni = valSnap.docs.map((v) => ({
      _docId: v.id,
      ...serializeForExport(v.data()),
    }));
    pazientiRows.push(
      docToExportRow(d.id, d.data(), {
        valutazioniSoccorso_json: JSON.stringify(valutazioni),
      }),
    );
  }

  downloadCsv(`CROSS_EVENTI_${ts}.csv`, buildCsvFromRows(eventiRows));
  downloadCsv(`CROSS_MISSIONI_${ts}.csv`, buildCsvFromRows(missioniRows));
  downloadCsv(`CROSS_MEZZI_${ts}.csv`, buildCsvFromRows(mezziRows));
  downloadCsv(`CROSS_PAZIENTI_${ts}.csv`, buildCsvFromRows(pazientiRows));

  return {
    eventi: eventiSnap.size,
    missioni: missioniSnap.size,
    mezzi: mezziSnap.size,
    pazienti: pazientiSnap.size,
  };
}
