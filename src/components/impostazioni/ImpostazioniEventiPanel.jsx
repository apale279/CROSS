import { TipiEventoChipsEditor } from './TipiEventoChipsEditor';
import { DettagliPerTipoEditor } from './DettagliPerTipoEditor';

export function ImpostazioniEventiPanel() {
  return (
    <div className="grid gap-4">
      <TipiEventoChipsEditor />
      <DettagliPerTipoEditor />
    </div>
  );
}
