import { useEffect, useRef, useState } from 'react';

const MIN_W = 220;
const MIN_H = 160;

export function FloatingPanel({
  title,
  alert,
  headerActions,
  layout,
  zIndex,
  onLayoutChange,
  onFocus,
  layoutConstraints,
  contentClassName = 'overflow-auto',
  children,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef(null);

  useEffect(() => {
    if (!dragging && !resizing) return undefined;

    const onMove = (e) => {
      const parent = containerRef.current?.parentElement;
      if (!parent || !startRef.current) return;
      const rect = parent.getBoundingClientRect();
      const { mode, startX, startY, orig } = startRef.current;

      if (mode === 'drag') {
        const dx = (e.clientX - startX) / rect.width;
        const dy = (e.clientY - startY) / rect.height;
        onLayoutChange({
          ...orig,
          x: Math.min(1 - orig.w, Math.max(0, orig.x + dx)),
          y: Math.min(1 - orig.h, Math.max(0, orig.y + dy)),
        });
      } else {
        const dw = (e.clientX - startX) / rect.width;
        const dh = (e.clientY - startY) / rect.height;
        const maxW = layoutConstraints?.maxW ?? 1 - orig.x;
        const maxH = layoutConstraints?.maxH ?? 1 - orig.y;
        onLayoutChange({
          ...orig,
          w: Math.min(maxW, Math.max(MIN_W / rect.width, orig.w + dw)),
          h: Math.min(maxH, Math.max(MIN_H / rect.height, orig.h + dh)),
        });
      }
    };

    const onUp = () => {
      setDragging(false);
      setResizing(false);
      startRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, resizing, onLayoutChange, layoutConstraints]);

  const startDrag = (e) => {
    if (e.target.closest('button')) return;
    onFocus?.();
    startRef.current = { mode: 'drag', startX: e.clientX, startY: e.clientY, orig: { ...layout } };
    setDragging(true);
  };

  const startResize = (e) => {
    e.stopPropagation();
    onFocus?.();
    startRef.current = { mode: 'resize', startX: e.clientX, startY: e.clientY, orig: { ...layout } };
    setResizing(true);
  };

  return (
    <section
      ref={containerRef}
      className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-md"
      style={{
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        width: `${layout.w * 100}%`,
        height: `${layout.h * 100}%`,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      <header
        ref={dragRef}
        onMouseDown={startDrag}
        className={`flex shrink-0 cursor-grab items-center justify-between border-b border-slate-300 bg-slate-50 px-3 py-2 active:cursor-grabbing ${
          dragging ? 'cursor-grabbing' : ''
        }`}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">{title}</h2>
        <div className="flex items-center gap-1">
          {headerActions}
          {alert}
        </div>
      </header>
      <div className={`min-h-0 min-w-0 flex-1 ${contentClassName}`}>{children}</div>
      <div
        role="presentation"
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-gradient-to-br from-transparent to-slate-400/60"
        title="Ridimensiona"
      />
    </section>
  );
}
