import { getPmaPatientDragDocId } from './pmaPostiLetto';

/** Distanza dal bordo (px) in cui parte lo scroll automatico. */
export const PMA_DRAG_AUTOSCROLL_EDGE_PX = 72;

/** Velocità massima scroll per frame (px). */
export const PMA_DRAG_AUTOSCROLL_MAX_STEP = 18;

let pointerX = 0;
let pointerY = 0;
let rafId = null;
let bound = false;

function isScrollableY(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const style = getComputedStyle(el);
  const oy = style.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight + 1;
}

function scrollStep(distFromEdge) {
  const edge = PMA_DRAG_AUTOSCROLL_EDGE_PX;
  const ratio = Math.max(0, Math.min(1, 1 - distFromEdge / edge));
  return Math.max(2, Math.round(PMA_DRAG_AUTOSCROLL_MAX_STEP * ratio));
}

function collectScrollContainers() {
  const out = new Set();
  const root = document.querySelector('.pma-viewport');
  if (root) {
    const stack = [root];
    while (stack.length) {
      const el = stack.pop();
      if (isScrollableY(el)) out.add(el);
      for (const child of el.children) stack.push(child);
    }
  }
  const main = root?.closest('main');
  if (main && isScrollableY(main)) out.add(main);
  return [...out];
}

function autoScrollVertical(clientX, clientY) {
  for (const el of collectScrollContainers()) {
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left - PMA_DRAG_AUTOSCROLL_EDGE_PX) continue;
    if (clientX > rect.right + PMA_DRAG_AUTOSCROLL_EDGE_PX) continue;

    const nearTop = clientY < rect.top + PMA_DRAG_AUTOSCROLL_EDGE_PX;
    const nearBottom = clientY > rect.bottom - PMA_DRAG_AUTOSCROLL_EDGE_PX;
    if (!nearTop && !nearBottom) continue;

    if (nearTop) {
      const dist = Math.max(0, clientY - (rect.top - PMA_DRAG_AUTOSCROLL_EDGE_PX));
      el.scrollTop -= scrollStep(
        clientY >= rect.top ? clientY - rect.top : PMA_DRAG_AUTOSCROLL_EDGE_PX - dist,
      );
    }
    if (nearBottom) {
      const dist = Math.max(0, rect.bottom + PMA_DRAG_AUTOSCROLL_EDGE_PX - clientY);
      el.scrollTop += scrollStep(
        clientY <= rect.bottom ? rect.bottom - clientY : PMA_DRAG_AUTOSCROLL_EDGE_PX - dist,
      );
    }
  }

  const winTop = clientY;
  const winBottom = window.innerHeight - clientY;
  if (winTop < PMA_DRAG_AUTOSCROLL_EDGE_PX) {
    window.scrollBy(0, -scrollStep(winTop));
  } else if (winBottom < PMA_DRAG_AUTOSCROLL_EDGE_PX) {
    window.scrollBy(0, scrollStep(winBottom));
  }
}

function tick() {
  if (!getPmaPatientDragDocId()) {
    stopPmaDragAutoScrollLoop();
    return;
  }
  autoScrollVertical(pointerX, pointerY);
  rafId = requestAnimationFrame(tick);
}

export function startPmaDragAutoScrollLoop() {
  if (rafId != null) return;
  rafId = requestAnimationFrame(tick);
}

export function stopPmaDragAutoScrollLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function onDragOver(e) {
  if (!getPmaPatientDragDocId()) return;
  pointerX = e.clientX;
  pointerY = e.clientY;
  startPmaDragAutoScrollLoop();
}

function onWheel(e) {
  if (!getPmaPatientDragDocId()) return;
  const under = document.elementsFromPoint(e.clientX, e.clientY);
  for (const el of under) {
    let node = el;
    while (node && node !== document.body) {
      if (isScrollableY(node)) {
        node.scrollTop += e.deltaY;
        e.preventDefault();
        return;
      }
      node = node.parentElement;
    }
  }
}

function onDragStart(e) {
  if (!getPmaPatientDragDocId()) return;
  pointerX = e.clientX;
  pointerY = e.clientY;
  startPmaDragAutoScrollLoop();
}

function onDragEnd() {
  stopPmaDragAutoScrollLoop();
}

/** Listener globali: auto-scroll e rotella durante drag paziente PMA. */
export function bindPmaDragAutoScroll() {
  if (bound) return () => {};
  bound = true;

  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragend', onDragEnd, true);
  document.addEventListener('drop', onDragEnd, true);
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });

  return () => {
    bound = false;
    stopPmaDragAutoScrollLoop();
    document.removeEventListener('dragstart', onDragStart);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragend', onDragEnd, true);
    document.removeEventListener('drop', onDragEnd, true);
    document.removeEventListener('wheel', onWheel, { capture: true });
  };
}
