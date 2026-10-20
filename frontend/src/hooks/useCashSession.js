import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'jasrain_cash_pending';
const SETTLE_MS = 1500; // wait a bit in case another bill is going in

const read = (total) => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.total === total && s.inserted > 0) return s;
  } catch (e) {
    /* ignore */
  }
  return null;
};
const write = (v) => {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch (e) {
    /* ignore */
  }
};

// Counts the cash inserted for one payment.
// accept(amount, kind) is the only way money gets in (simulator buttons or the real machine).
// Inserted cash is kept if the page reloads.
export function useCashSession(total, onComplete) {
  const [state, setState] = useState(() => {
    const saved = read(total);
    return saved ? { inserted: saved.inserted, log: saved.log || [] } : { inserted: 0, log: [] };
  });
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const cb = useRef(onComplete);
  cb.current = onComplete;

  const accept = useCallback((amount, kind = 'cash') => {
    if (doneRef.current || !(amount > 0)) return;
    setState((s) => ({ inserted: s.inserted + amount, log: [...s.log, { amount, kind, at: new Date().toISOString() }] }));
  }, []);

  useEffect(() => {
    if (state.inserted > 0 && !doneRef.current) write({ total, inserted: state.inserted, log: state.log });
    if (total > 0 && state.inserted >= total && !doneRef.current) {
      const t = setTimeout(() => {
        doneRef.current = true;
        setDone(true);
        write(null);
        cb.current({ received: state.inserted, change: Math.max(0, state.inserted - total), log: state.log });
      }, SETTLE_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state, total]);

  return {
    inserted: state.inserted,
    log: state.log,
    remaining: Math.max(0, total - state.inserted),
    change: Math.max(0, state.inserted - total),
    complete: state.inserted >= total && total > 0,
    done,
    accept,
  };
}
