import { useState } from 'react';
import { StazionamentiEditor } from '../components/impostazioni/StazionamentiEditor';
import { ListEditorField } from '../components/impostazioni/ListEditorField';
import { TipiMezzoEditor } from '../components/impostazioni/TipiMezzoEditor';
import { ImpostazioniEventiPanel } from '../components/impostazioni/ImpostazioniEventiPanel';
import { PartecipantiRegistryEditor } from '../components/impostazioni/PartecipantiRegistryEditor';
import { WipeOpsDangerZone } from '../components/impostazioni/WipeOpsDangerZone';
import { MappaDashboardCentroEditor } from '../components/impostazioni/MappaDashboardCentroEditor';
import { TelegramBotPasswordEditor } from '../components/impostazioni/TelegramBotPasswordEditor';
import { InfoLuogoPanel } from '../components/impostazioni/InfoLuogoPanel';
import { GlobalLogoutPuliziaPanel } from '../components/impostazioni/GlobalLogoutPuliziaPanel';
import { TelegramForceLogoutPanel } from '../components/impostazioni/TelegramForceLogoutPanel';

const ALTRE_LISTE = {
  listaOspedali: 'Lista ospedali',
};

const tabClass = (active) =>
  `border-b-2 px-4 py-2 text-sm font-bold uppercase tracking-wide ${
    active
      ? 'border-sky-600 text-sky-700'
      : 'border-transparent text-slate-500 hover:text-slate-700'
  }`;

export default function ImpostazioniPage() {
  const [tab, setTab] = useState('eventi');

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-2">
      <h2 className="mb-4 text-xl font-bold uppercase text-slate-900">Impostazioni</h2>

      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        <button type="button" className={tabClass(tab === 'eventi')} onClick={() => setTab('eventi')}>
          Impostazioni eventi
        </button>
        <button type="button" className={tabClass(tab === 'infoLuogo')} onClick={() => setTab('infoLuogo')}>
          INFO LUOGO
        </button>
        <button type="button" className={tabClass(tab === 'altro')} onClick={() => setTab('altro')}>
          Mezzi e strutture
        </button>
        <button type="button" className={tabClass(tab === 'telegram')} onClick={() => setTab('telegram')}>
          Telegram
        </button>
      </nav>

      {tab === 'eventi' && <ImpostazioniEventiPanel />}

      {tab === 'infoLuogo' && <InfoLuogoPanel />}

      {tab === 'telegram' && (
        <div className="grid gap-4">
          <TelegramBotPasswordEditor />
          <TelegramForceLogoutPanel />
          <GlobalLogoutPuliziaPanel />
        </div>
      )}

      {tab === 'altro' && (
        <div className="grid gap-4">
          <TipiMezzoEditor />
          {Object.entries(ALTRE_LISTE).map(([key, label]) => (
            <ListEditorField key={key} fieldKey={key} label={label} />
          ))}
          <StazionamentiEditor />
          <MappaDashboardCentroEditor />
          <PartecipantiRegistryEditor />
          <WipeOpsDangerZone />
        </div>
      )}
    </div>
  );
}
