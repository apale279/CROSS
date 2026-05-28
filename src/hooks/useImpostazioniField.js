import { useCallback, useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { impostazioniValuesMatch } from '../lib/impostazioniEqual';
import {
  isImpostazioniFieldSaveBlocked,
  readImpostazioniFieldForDisplay,
  readImpostazioniFieldRaw,
} from '../lib/impostazioniFieldAccess';
import { useManifestationId } from '../context/ManifestazioneContext';
import { useFirestoreSync } from '../context/FirestoreSyncContext';
import {
  impostazioniDocRef,
  saveImpostazioniField,
} from '../services/impostazioniService';

/**
 * Ascolta Firestore e salva un solo campo scalare/array per volta.
 * Mappe annidate (dettagli*, pmaClinica): sola lettura qui — usare API puntate dedicate.
 */
export function useImpostazioniField(fieldKey) {
  const manifestationId = useManifestationId();
  const { reportSync, reportError } = useFirestoreSync();
  const nestedObjectField = isImpostazioniFieldSaveBlocked(fieldKey);
  const [value, setValue] = useState(() => readImpostazioniFieldForDisplay(null, fieldKey));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const valueRef = useRef(value);
  const pendingRef = useRef(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    pendingRef.current = null;
    setLoading(true);

    const docRef = impostazioniDocRef(manifestationId);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (cancelled) return;
        reportSync();

        const raw = snap.exists() ? readImpostazioniFieldRaw(snap.data(), fieldKey) : undefined;
        const serverValue = readImpostazioniFieldForDisplay(
          snap.exists() ? snap.data() : null,
          fieldKey,
        );

        if (pendingRef.current !== null) {
          if (impostazioniValuesMatch(raw ?? serverValue, pendingRef.current)) {
            pendingRef.current = null;
            setValue(serverValue);
          } else {
            setValue(pendingRef.current);
          }
        } else {
          setValue(serverValue);
        }

        setLoading(false);
      },
      (err) => {
        console.error(`onSnapshot impostazioni.${fieldKey}:`, err);
        reportError(err);
        if (!cancelled) setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [manifestationId, fieldKey, reportSync, reportError]);

  const saveField = useCallback(
    async (nextValueOrUpdater) => {
      if (nestedObjectField) {
        throw new Error(
          `Salvataggio di «${fieldKey}» bloccato: usare update puntati (es. saveDettaglioTipoLuogo).`,
        );
      }

      const prev = valueRef.current;
      const resolved =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(prev)
          : nextValueOrUpdater;

      pendingRef.current = resolved;
      valueRef.current = resolved;
      setValue(resolved);
      setSaving(true);

      try {
        await saveImpostazioniField(manifestationId, fieldKey, resolved);
      } catch (err) {
        pendingRef.current = null;
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [manifestationId, fieldKey, nestedObjectField],
  );

  return {
    value,
    saveField,
    saving,
    loading,
    readOnly: nestedObjectField,
  };
}
