import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// enabled = false pauses the timer (while paying)
export function useIdleTimer(timeoutMs = 60000, onTimeout, enabled = true) {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (onTimeout) onTimeout();
      navigate('/');
    }, timeoutMs);
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    
    // reset the timer on any activity
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer(); // start the timer

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [navigate, timeoutMs, enabled]);
}