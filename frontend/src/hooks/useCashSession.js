import { useCallback, useEffect, useRef, useState } from 'react';
import { CASH_MODE, piUrl } from '../utils/cash';
import { piFetch } from '../utils/piFetch';

const KEY = 'jasrain_cash_pending';
const POLL_MS = 500;
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
// blocked: true while payment must wait (for example an item is still in the basket).
// While blocked, no cash is counted and the payment is never completed, so no receipt is made.
export function useCashSession(total, onComplete, blocked = false) {
  const [state, setState] = useState(() => {
    const saved = read(total);
    return saved ? { inserted: saved.inserted, log: saved.log || [] } : { inserted: 0, log: [] };
  });
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const cb = useRef(onComplete);
  cb.current = onComplete;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const accept = useCallback((amount, kind = 'cash') => {
    if (doneRef.current || blockedRef.current || !(amount > 0)) return;
    setState((s) => ({ inserted: s.inserted + amount, log: [...s.log, { amount, kind, at: new Date().toISOString() }] }));
  }, []);

  // Real machine: ask the Pi for new cash. Skipped while blocked, so the Pi keeps it until we are ready.
  const [link, setLink] = useState('unknown'); // 'unknown' | 'ok' | 'down'
  useEffect(() => {
    if (CASH_MODE !== 'hardware') return undefined;
    let busy = false;
    const tick = async () => {
      if (busy || doneRef.current || blockedRef.current) return;
      busy = true;
      try {
        const res = await piFetch(`${piUrl()}/cash/take`, { cache: 'no-store' });
        const data = await res.json();
        (data.events || []).forEach((e) => accept(e.amount, e.kind));
        setLink('ok');
      } catch (e) {
        setLink('down');
      } finally {
        busy = false;
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [accept]);

  // Tell the Pi when it may take cash (it can switch the acceptors off while blocked or finished).
  useEffect(() => {
    if (CASH_MODE !== 'hardware') return undefined;
    const send = (on) => piFetch(`${piUrl()}/enable`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) }).catch(() => {});
    send(!blocked && !done);
    return () => { send(false); };
  }, [blocked, done]);

  useEffect(() => {
    if (state.inserted > 0 && !doneRef.current) write({ total, inserted: state.inserted, log: state.log });
    if (total > 0 && state.inserted >= total && !doneRef.current && !blocked) {
      const t = setTimeout(() => {
        doneRef.current = true;
        setDone(true);
        write(null);
        cb.current({ received: state.inserted, change: Math.max(0, state.inserted - total), log: state.log });
      }, SETTLE_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state, total, blocked]);

  return {
    inserted: state.inserted,
    log: state.log,
    remaining: Math.max(0, total - state.inserted),
    change: Math.max(0, state.inserted - total),
    complete: state.inserted >= total && total > 0,
    done,
    accept,
    blocked,
    link,
  };
}
