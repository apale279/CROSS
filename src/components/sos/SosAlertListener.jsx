import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTenantContext } from '../../context/TenantContext';
import { acknowledgeSosAlert, subscribeSosAlerts } from '../../services/sosAlertsService';
import { btnPrimary } from '../ui/FormField';

export function SosAlertListener() {
  const { tenantId } = useTenantContext();
  const [queue, setQueue] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!tenantId) return undefined;
    return subscribeSosAlerts(tenantId, (alerts) => {
      setQueue((prev) => {
        const incoming = alerts.filter((a) => a._docId && !seenRef.current.has(a._docId));
        if (!incoming.length) return prev;
        for (const a of incoming) seenRef.current.add(a._docId);
        return [...prev, ...incoming];
      });
    });
  }, [tenantId]);

  const current = queue[0] ?? null;

  const dismiss = async () => {
    if (!current || !tenantId) return;
    try {
      await acknowledgeSosAlert(tenantId, current._docId);
    } catch (e) {
      console.warn('ack sos:', e);
    }
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  const sigla = current.mezzo ?? '—';

  return createPortal(
    <div
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-red-950/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-alert-title"
    >
      <div className="w-full max-w-md rounded-xl border-4 border-red-500 bg-white p-6 shadow-2xl">
        <p id="sos-alert-title" className="text-center text-2xl font-black leading-tight text-red-700">
          🚨 ALLARME INVIATO DA {sigla}
        </p>
        <p className="mt-3 text-center text-sm text-slate-600">
          Segnalazione SOS da equipaggio Telegram. Verifica subito la situazione sul campo.
        </p>
        <button type="button" className={`${btnPrimary} mt-6 w-full`} onClick={() => void dismiss()}>
          Ho preso visione
        </button>
      </div>
    </div>,
    document.body,
  );
}
