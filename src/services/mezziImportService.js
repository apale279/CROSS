import { normalizeMezzoKey } from '../lib/mezzoMissione';
import {
  buildMezziImportPlan,
  parseFlottaMezziExcel,
} from '../lib/parseFlottaMezziExcel';
import { createMezzo } from './mezziService';
import { saveImpostazioniField } from './impostazioniService';

/**
 * Importa mezzi dal foglio FLOTTA (stesso file «FLOTTA RESEGUP»).
 * @returns Riepilogo operazione
 */
export async function importMezziFromFlottaExcel(
  manifestationId,
  arrayBuffer,
  { stazionamenti, tipiMezzo, existingMezzi },
) {
  const { sheetName, entries } = parseFlottaMezziExcel(arrayBuffer);
  if (!entries.length) {
    throw new Error(
      'Nessuna riga valida nel foglio FLOTTA (A=sigla, B=tipo, C=stazionamento).',
    );
  }

  const plan = buildMezziImportPlan({
    rows: entries,
    stazionamenti: stazionamenti ?? [],
    tipiMezzo: tipiMezzo ?? [],
    existingMezzi: existingMezzi ?? [],
    normalizeMezzoKey,
  });

  if (plan.tipiAggiunti.length) {
    await saveImpostazioniField(manifestationId, 'tipiMezzo', plan.nextTipi);
  }

  for (const item of plan.toCreate) {
    await createMezzo(manifestationId, item.sigla, item.payload);
  }

  return {
    sheetName,
    created: plan.toCreate.length,
    skipped: plan.skipped,
    tipiAggiunti: plan.tipiAggiunti,
    missingStazionamenti: plan.missingStazionamenti,
  };
}
