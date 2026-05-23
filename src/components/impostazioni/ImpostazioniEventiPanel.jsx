import { useState } from 'react';
import { TipiEventoChipsEditor } from './TipiEventoChipsEditor';
import { DettagliPerTipoEditor } from './DettagliPerTipoEditor';
import { ImpostazioniLuogoPanel } from './ImpostazioniLuogoPanel';

const subTabClass = (active) =>
  `border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
    active
      ? 'border-sky-600 text-sky-700'
      : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export function ImpostazioniEventiPanel() {
  const [subTab, setSubTab] = useState('evento');

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          className={subTabClass(subTab === 'evento')}
          onClick={() => setSubTab('evento')}
        >
          Tipo evento / dettaglio
        </button>
        <button
          type="button"
          className={subTabClass(subTab === 'luogo')}
          onClick={() => setSubTab('luogo')}
        >
          Impostazioni luogo
        </button>
      </nav>

      {subTab === 'evento' && (
        <div className="grid gap-4">
          <TipiEventoChipsEditor />
          <DettagliPerTipoEditor />
        </div>
      )}

      {subTab === 'luogo' && <ImpostazioniLuogoPanel />}
    </div>
  );
}
