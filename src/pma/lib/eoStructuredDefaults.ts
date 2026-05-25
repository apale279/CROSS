import { EO_CLINICAL_TABS } from './multilineList';
import { defaultEoLabelForColumn, normalizeEoQuickLabels } from './eoQuickSelection';
import structuredRaw from './eoStructuredDefaults.json';

type EoTab = (typeof EO_CLINICAL_TABS)[number];

/** Voci EO rapido da `Prompt_local/Esame_Obiettivo_Strutturato.xlsx` (riga 1 = titolo sezione). */
export function structuredDettaglioEoRapido(): Record<EoTab, string[]> {
  const raw = structuredRaw as Record<string, string[]>;
  return Object.fromEntries(
    EO_CLINICAL_TABS.map((tab) => [
      tab,
      normalizeEoQuickLabels(raw[tab]?.length ? [...raw[tab]] : ['NELLA NORMA']),
    ]),
  ) as Record<EoTab, string[]>;
}

export function structuredEoQuickGroupRows() {
  const byTab = structuredDettaglioEoRapido();
  return EO_CLINICAL_TABS.map((title) => ({
    title,
    labels: byTab[title] ?? [],
  }));
}

export function structuredEoRapidoDefault(): string {
  return defaultEoLabelForColumn(structuredDettaglioEoRapido().GENERALE ?? []);
}
