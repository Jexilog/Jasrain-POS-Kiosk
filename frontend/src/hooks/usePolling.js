import { useEffect, useRef } from 'react';

// Runs fn now, then every `ms` milliseconds and when the window gets focus.
// Change `key` to run it again straight away (for example after signing in).
export function usePolling(fn, ms, key = '') {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    latest.current();
    const timer = setInterval(() => {
      if (!document.hidden) latest.current();
    }, ms);
    const onFocus = () => latest.current();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [ms, key]);
}
