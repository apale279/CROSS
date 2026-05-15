import { useEffect, useState } from 'react';
import { formatElapsed } from '../utils/formatters';

export function useElapsedSince(timestamp) {
  const [label, setLabel] = useState('—');

  useEffect(() => {
    const toMs = () => {
      if (!timestamp) return null;
      const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      if (Number.isNaN(d.getTime())) return null;
      return Date.now() - d.getTime();
    };

    const tick = () => {
      const ms = toMs();
      setLabel(ms == null ? '—' : formatElapsed(ms));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}
