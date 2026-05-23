import { TipiLuogoChipsEditor } from './TipiLuogoChipsEditor';
import { DettagliPerTipoLuogoEditor } from './DettagliPerTipoLuogoEditor';

export function ImpostazioniLuogoPanel() {
  return (
    <div className="grid gap-4">
      <TipiLuogoChipsEditor />
      <DettagliPerTipoLuogoEditor />
    </div>
  );
}
