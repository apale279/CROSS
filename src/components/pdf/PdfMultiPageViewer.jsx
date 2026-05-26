import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** URL senza fragment `#view=…` (usato da embed nativo, non da PDF.js). */
export function pdfSourceUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  return raw.split('#')[0];
}

/**
 * Viewer scrollabile con tutte le pagine (Safari iPad con `<embed>` mostra solo la prima).
 */
export function PdfMultiPageViewer({ url, className = '' }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const pdfUrl = pdfSourceUrl(url);

  useEffect(() => {
    const container = containerRef.current;
    if (!pdfUrl || !container) return undefined;

    let cancelled = false;
    let loadingTask = null;
    let resizeTimer = null;
    let lastWidth = 0;

    async function renderAll() {
      const containerWidth = Math.max(container.clientWidth, 280);
      if (Math.abs(containerWidth - lastWidth) < 20 && lastWidth > 0) return;
      lastWidth = containerWidth;

      setStatus('loading');
      setErrorMsg('');
      container.innerHTML = '';

      try {
        loadingTask?.destroy?.();
        loadingTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${containerWidth}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = 'mx-auto block max-w-full bg-white shadow-sm mb-2';

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }

        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(
            e instanceof Error ? e.message : 'Impossibile caricare il documento PDF.',
          );
        }
      }
    }

    const scheduleRender = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        void renderAll();
      }, 250);
    };

    scheduleRender();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => scheduleRender())
        : null;
    ro?.observe(container);

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      ro?.disconnect();
      loadingTask?.destroy?.();
      container.innerHTML = '';
    };
  }, [pdfUrl]);

  return (
    <div className={className}>
      {status === 'loading' ? (
        <p className="p-6 text-center text-sm text-slate-600">Caricamento documento…</p>
      ) : null}
      {status === 'error' ? (
        <div className="p-6 text-center">
          <p className="text-sm text-red-800" role="alert">
            {errorMsg}
          </p>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-teal-800 underline"
            >
              Apri PDF in nuova scheda
            </a>
          ) : null}
        </div>
      ) : null}
      <div ref={containerRef} className="flex flex-col items-stretch px-1 py-2" />
    </div>
  );
}
