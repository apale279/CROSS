import { useCallback, useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { impostazioniValuesMatch } from '../lib/impostazioniEqual';
import { normalizeImpostazioni } from '../lib/impostazioniNormalize';
import { useManifestationId } from '../context/ManifestazioneContext';
import { useFirestoreSync } from '../context/FirestoreSyncContext';
import {
  impostazioniDocRef,
  saveImpostazioniField,
} from '../services/impostazioniService';

function defaultForField(fieldKey) {
  if (fieldKey === 'dettagliPerTipoEvento') return {};
  if (fieldKey === 'mappaDashboardDefault' || fieldKey === 'piantina_url') return null;
  if (fieldKey === 'luogo_fisico') return '';
  return DEFAULT_IMPOSTAZIONI[fieldKey] ?? null;
}

/**
 * Ascolta Firestore e salva un solo campo per volta (updateDoc su quella chiave).
 */
export function useImpostazioniField(fieldKey) {
  const manifestationId = useManifestationId();
  const { reportSync, reportError } = useFirestoreSync();
  const [value, setValue] = useState(() => defaultForField(fieldKey));
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

        const serverValue = snap.exists()
          ? (normalizeImpostazioni(snap.data())[fieldKey] ?? defaultForField(fieldKey))
          : defaultForField(fieldKey);

        if (pendingRef.current !== null) {
          if (impostazioniValuesMatch(serverValue, pendingRef.current)) {
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
    [manifestationId, fieldKey],
  );

  return { value, saveField, saving, loading };
}
