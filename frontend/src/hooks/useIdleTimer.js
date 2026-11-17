import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Sends the customer back to the start after timeoutMs without a touch.
// Before that, warnMs earlier, it shows an "Are you still there?" notice with a countdown.
// enabled = false pauses the timer (while paying).
//
// It returns { warning, secondsLeft, warnSeconds, stay }. Give that to <IdleWarning idle={...} /> to show the notice.
// Callers that ignore the return value keep working exactly as before.
export function useIdleTimer(timeoutMs = 60000, onTimeout, enabled = true, warnMs = 15000) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);   // kept in a ref so a new navigate function never restarts the countdown
  navigateRef.current = navigate;
  const [secondsLeft, setSecondsLeft] = useState(null); // null = no notice on screen
  const callback = useRef(onTimeout);
  callback.current = onTimeout;
  const warningOn = useRef(false);
  const timers = useRef({ warn: null, end: null, tick: null });
  const warnSeconds = Math.max(1, Math.round(Math.min(warnMs, timeoutMs / 2) / 1000));

  const clearAll = () => {
    clearTimeout(timers.current.warn);
    clearTimeout(timers.current.end);
    clearInterval(timers.current.tick);
  };

  // (re)start the countdown from zero
  const start = useCallback(() => {
    clearAll();
    warningOn.current = false;
    setSecondsLeft(null);
    const warnFor = warnSeconds * 1000;

    timers.current.warn = setTimeout(() => {
      warningOn.current = true;
      const deadline = Date.now() + warnFor;
      setSecondsLeft(warnSeconds);
      timers.current.tick = setInterval(() => {
        setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      }, 250);
    }, timeoutMs - warnFor);

    timers.current.end = setTimeout(() => {
      clearAll();
      warningOn.current = false;
      setSecondsLeft(null);
      if (callback.current) callback.current();
      navigateRef.current('/');
    }, timeoutMs);
  }, [timeoutMs, warnSeconds]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      warningOn.current = false;
      setSecondsLeft(null);
      return undefined;
    }
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    // any touch or click counts as "I'm here". While the notice is showing, a mouse that merely moves does not.
    const onActivity = (e) => {
      if (warningOn.current && e.type === 'mousemove') return;
      start();
    };
    events.forEach((event) => window.addEventListener(event, onActivity));
    start();

    return () => {
      clearAll();
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [enabled, start]);

  return { warning: secondsLeft !== null, secondsLeft: secondsLeft ?? 0, warnSeconds, stay: start };
}
