import { useCallback, useState } from 'react';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import {
  createNotaDiario,
  deleteNotaDiario,
  patchNotaDiario,
} from '../services/diarioService';

export function useDiarioNotaActions({ onAfterSave, onAfterDelete } = {}) {
  const manifestationId = useManifestazioneId();
  const [saving, setSaving] = useState(false);

  const run = useCallback(async (fn) => {
    setSaving(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      alert('Errore: ' + err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const createNota = useCallback(
    async (payload) => {
      await run(async () => {
        const { docId } = await createNotaDiario(manifestationId, payload);
        onAfterSave?.(docId);
      });
    },
    [manifestationId, onAfterSave, run],
  );

  const updateNota = useCallback(
    async (docId, payload) => {
      await run(async () => {
        await patchNotaDiario(manifestationId, docId, payload);
        onAfterSave?.(docId);
      });
    },
    [manifestationId, onAfterSave, run],
  );

  const toggleChiusa = useCallback(
    async (nota, aperta) => {
      await run(async () => {
        await patchNotaDiario(manifestationId, nota._docId, { aperta });
      });
    },
    [manifestationId, run],
  );

  const toggleImportante = useCallback(
    async (nota, importante) => {
      await run(async () => {
        await patchNotaDiario(manifestationId, nota._docId, { importante });
      });
    },
    [manifestationId, run],
  );

  const removeNota = useCallback(
    async (docId) => {
      await run(async () => {
        await deleteNotaDiario(manifestationId, docId);
        onAfterDelete?.(docId);
      });
    },
    [manifestationId, onAfterDelete, run],
  );

  return {
    saving,
    createNota,
    updateNota,
    toggleChiusa,
    toggleImportante,
    removeNota,
  };
}
