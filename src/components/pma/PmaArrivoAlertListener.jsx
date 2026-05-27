import { useEffect, useMemo, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import { Link, useLocation } from 'react-router-dom';

import { collection, onSnapshot } from 'firebase/firestore';

import { db } from '../../firebaseConfig';

import { useManifestationId } from '../../context/ManifestazioneContext';

import { usePmaAccess } from '../../hooks/usePmaAccess';

import { useImpostazioni } from '../../hooks/useImpostazioni';

import { missioniPath, pazientiPath } from '../../lib/firestorePaths';

import { findPmaById } from '../../lib/pmaModule';

import {

  detectNuoviDirettoHPma,

  loadPmaDirettoHNotified,

  markPmaDirettoHNotified,

  pazienteInArrivoLabel,

  sottotitoloAlertPmaArrivo,

  startPmaArrivoAlertLoop,

  stopPmaArrivoAlertLoop,

  titoloAlertPmaArrivo,

  unlockPmaAlertAudio,

} from '../../lib/pmaArrivoAlert';

import { btnPrimary, btnSecondary } from '../ui/FormField';



function enqueueAlerts(prev, incoming) {

  if (!incoming.length) return prev;

  const keys = new Set(prev.map((a) => a.alertKey));

  const nuovi = incoming.filter((a) => !keys.has(a.alertKey));

  return nuovi.length ? [...prev, ...nuovi] : prev;

}



/**

 * Popup + suono una sola volta per missione+PMA al passaggio a DIRETTO H.

 */

export function PmaArrivoAlertListener() {

  const manifestationId = useManifestationId();

  const { pathname } = useLocation();

  const { impostazioni } = useImpostazioni();

  const { accessiblePma, scopeId, isPmaOperator, loading } = usePmaAccess();

  const [queue, setQueue] = useState([]);

  const primedRef = useRef(false);

  const missionFlagsRef = useRef(new Map());

  const notifiedRef = useRef(new Set());

  const pazientiDocsRef = useRef([]);

  const missioniDocsRef = useRef([]);



  const pmaIdsKey = useMemo(

    () => accessiblePma.map((p) => p.id).sort().join(','),

    [accessiblePma],

  );

  const accessibleIds = useMemo(() => accessiblePma.map((p) => p.id), [pmaIdsKey]);



  const onPmaArea = pathname === '/pma' || pathname.startsWith('/pma/');

  const listenEnabled =

    !loading && accessibleIds.length > 0 && (isPmaOperator || Boolean(scopeId) || onPmaArea);



  useEffect(() => {

    const unlock = () => unlockPmaAlertAudio();

    window.addEventListener('pointerdown', unlock, { passive: true });

    window.addEventListener('keydown', unlock);

    return () => {

      window.removeEventListener('pointerdown', unlock);

      window.removeEventListener('keydown', unlock);

    };

  }, []);



  useEffect(() => {

    primedRef.current = false;

    missionFlagsRef.current = new Map();

    pazientiDocsRef.current = [];

    missioniDocsRef.current = [];

    notifiedRef.current = manifestationId ? loadPmaDirettoHNotified(manifestationId) : new Set();

  }, [manifestationId, pmaIdsKey]);



  useEffect(() => {

    if (!listenEnabled) {

      setQueue([]);

      stopPmaArrivoAlertLoop();

    }

  }, [listenEnabled]);



  const processMissionSnapshot = useRef(() => {});



  processMissionSnapshot.current = () => {

    if (!manifestationId) return;



    const pazienti = pazientiDocsRef.current.map((d) => ({ _docId: d.id, ...d.data() }));

    const { incoming, nextFlags } = detectNuoviDirettoHPma(

      missioniDocsRef.current,

      pazienti,

      accessibleIds,

      missionFlagsRef.current,

      primedRef.current,

      notifiedRef.current,

    );

    missionFlagsRef.current = nextFlags;



    if (!primedRef.current) {

      primedRef.current = true;

      return;

    }



    if (!incoming.length) return;



    const keys = incoming.map((a) => a.alertKey);

    notifiedRef.current = markPmaDirettoHNotified(manifestationId, notifiedRef.current, keys);

    setQueue((prev) => enqueueAlerts(prev, incoming));

  };



  const acknowledgeCurrent = () => {

    if (!manifestationId || !queue[0]) return;

    notifiedRef.current = markPmaDirettoHNotified(manifestationId, notifiedRef.current, [

      queue[0].alertKey,

    ]);

  };



  useEffect(() => {

    if (!listenEnabled || !manifestationId) return undefined;



    const unsubPaz = onSnapshot(

      collection(db, ...pazientiPath(manifestationId)),

      (snap) => {

        pazientiDocsRef.current = snap.docs;

      },

      (err) => console.error('[PmaArrivoAlert] pazienti:', err),

    );



    const unsubMis = onSnapshot(

      collection(db, ...missioniPath(manifestationId)),

      (snap) => {

        missioniDocsRef.current = snap.docs;

        try {

          processMissionSnapshot.current();

        } catch (err) {

          console.error('[PmaArrivoAlert] missioni:', err);

        }

      },

      (err) => console.error('[PmaArrivoAlert] missioni:', err),

    );



    return () => {

      unsubPaz();

      unsubMis();

    };

  }, [listenEnabled, manifestationId, accessibleIds, pmaIdsKey]);



  const current = queue[0] ?? null;



  useEffect(() => {

    if (queue.length > 0) {

      startPmaArrivoAlertLoop();

      return () => stopPmaArrivoAlertLoop();

    }

    stopPmaArrivoAlertLoop();

    return undefined;

  }, [queue.length]);



  const dismiss = () => {

    acknowledgeCurrent();

    stopPmaArrivoAlertLoop();

    setQueue((q) => q.slice(1));

  };



  if (!current) return null;



  const pma = findPmaById(impostazioni, current.pmaId);

  const pmaNome = pma?.nome ?? current.pmaId;

  const pazienti = current.pazienti ?? [];

  const deskPath = `/pma/${encodeURIComponent(current.pmaId)}`;

  const n = pazienti.length;



  return createPortal(

    <div

      className="fixed inset-0 z-[2100] flex items-center justify-center bg-sky-950/60 p-4"

      role="alertdialog"

      aria-modal="true"

      aria-labelledby="pma-arrivo-alert-title"

    >

      <div className="w-full max-w-md rounded-xl border-4 border-sky-500 bg-white p-6 shadow-2xl">

        <p

          id="pma-arrivo-alert-title"

          className="text-center text-xl font-black leading-tight text-sky-800"

        >

          {titoloAlertPmaArrivo()}

        </p>

        <p className="mt-2 text-center text-sm font-semibold text-slate-800">{pmaNome}</p>

        {n <= 1 ? (

          <p className="mt-3 text-center text-base text-slate-700">

            {pazienteInArrivoLabel(pazienti[0]?.paziente)}

          </p>

        ) : (

          <div className="mt-3">

            <p className="text-center text-sm font-semibold text-slate-800">

              {n} pazienti sullo stesso mezzo

            </p>

            <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm text-slate-700">

              {pazienti.map((item) => (

                <li key={item.pazienteDocId}>{pazienteInArrivoLabel(item.paziente)}</li>

              ))}

            </ul>

          </div>

        )}

        <p className="mt-2 text-center text-xs text-slate-500">{sottotitoloAlertPmaArrivo(current)}</p>

        <p className="mt-1 text-center text-xs text-slate-500">

          Compare in «In arrivo» al desk fino a presa in carico.

        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">

          <Link

            to={deskPath}

            className={`${btnPrimary} flex-1 text-center`}

            onClick={() => {

              acknowledgeCurrent();

              stopPmaArrivoAlertLoop();

              setQueue((q) => q.slice(1));

            }}

          >

            Apri desk PMA

          </Link>

          <button type="button" className={`${btnSecondary} flex-1`} onClick={dismiss}>

            Ho preso visione

          </button>

        </div>

        {queue.length > 1 ? (

          <p className="mt-3 text-center text-xs text-slate-500">

            +{queue.length - 1} altri avvisi in coda

          </p>

        ) : null}

      </div>

    </div>,

    document.body,

  );

}

