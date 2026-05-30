import { useCallback, useState } from 'react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { saveDettaglioTipoLuogo } from '../../services/impostazioniService';
import { ListEditor } from './ListEditor';

export function DettagliPerTipoLuogoEditor() {
  const manifestationId = useManifestazioneId();
  const { value: tipi, loading: loadingTipi } = useImpostazioniField('tipiLuogo');
  const { value: dettagliMap, loading } = useImpostazioniField('dettagliPerTipoLuogo');
  const [savingTipo, setSavingTipo] = useState(null);

  const tipiList = tipi ?? [];
  const map = dettagliMap && typeof dettagliMap === 'object' ? dettagliMap : {};

  const saveTipo = useCallback(
    async (tipo, list) => {
      setSavingTipo(tipo);
      try {
        await saveDettaglioTipoLuogo(manifestationId, tipo, list);
      } finally {
        setSavingTipo(null);
      }
    },
    [manifestationId],
  );

  if (loadingTipi || loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento dettagli per tipo luogo…
      </section>
    );
  }

  if (tipiList.length === 0) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold uppercase text-slate-800">Dettaglio luogo per tipo</h3>
        <p className="mt-2 text-sm text-slate-500">
          Aggiungi almeno un valore in «Tipo luogo» per configurare i dettagli.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold uppercase text-slate-800">Dettaglio luogo per tipo</h3>
        <p className="mt-1 text-xs text-slate-500">
          Ogni tipo luogo ha la propria lista. «Salva» aggiorna solo quel tipo, senza toccare gli altri.
        </p>
      </div>
      {tipiList.map((tipo) => (
        <ListEditor
          key={tipo}
          label={`Dettaglio — ${tipo}`}
          fieldKey={tipo}
          items={map[tipo] ?? []}
          saving={savingTipo === tipo}
          onSave={async (partial) => {
            await saveTipo(tipo, partial[tipo]);
          }}
        />
      ))}
    </section>
  );
}
