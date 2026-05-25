import { useMemo } from 'react';
import { buildPmaIpadPairingUrl } from '../../lib/pmaIpadSession';
import { pmaIpadCredentialsFromEntry } from '../../lib/pmaIpadCredentials';

/**
 * Sola lettura: credenziali iPad e QR per un PMA (definite alla creazione PMA).
 */
export function PmaIpadFirmaInfoPanel({ pma }) {
  const creds = useMemo(() => pmaIpadCredentialsFromEntry(pma), [pma]);
  const pairingUrl = useMemo(
    () => (pma?.id ? buildPmaIpadPairingUrl(pma.id) : ''),
    [pma?.id],
  );
  const qrSrc = pairingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(pairingUrl)}`
    : '';

  return (
    <div className="space-y-4 text-sm text-slate-800">
      <p className="text-xs leading-relaxed text-slate-600">
        Account creato automaticamente con il PMA. Sull&apos;iPad apri il link o scansiona il QR: accesso
        automatico. Da PC, in <strong>Dimissione</strong>, usa «Invia documento a iPad per firma».
        Un solo documento alla volta; un nuovo invio sostituisce quello in attesa.
      </p>

      <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase text-slate-500">Utente iPad</dt>
          <dd className="mt-0.5 font-mono font-semibold text-slate-900">{creds.ipadUser}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-500">Password</dt>
          <dd className="mt-0.5 font-mono font-semibold text-slate-900">{creds.ipadPassword}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase text-slate-500">Email login (Firebase)</dt>
          <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{creds.ipadEmail}</dd>
        </div>
      </dl>

      {qrSrc ? (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <img
            src={qrSrc}
            alt="QR iPad firma PMA"
            className="rounded-lg border border-slate-200 bg-white p-2"
            width={220}
            height={220}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Link iPad</p>
            <p className="break-all font-mono text-xs text-slate-800">{pairingUrl}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
