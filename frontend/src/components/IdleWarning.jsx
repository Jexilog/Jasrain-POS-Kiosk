import React from 'react';
import { useKiosk } from '../context/KioskContext';
import './IdleWarning.css';

// "Are you still there?" notice with a countdown. Shows only while idle.warning is true.
//   const idle = useIdleTimer(...);    <IdleWarning idle={idle} />
// message is optional, for example 'Your cart will be cleared in {seconds} seconds.'
export default function IdleWarning({ idle, message }) {
  const { t } = useKiosk();
  if (!idle || !idle.warning) return null;

  const { secondsLeft, warnSeconds, stay } = idle;
  const R = 54;
  const C = 2 * Math.PI * R;
  const used = 1 - secondsLeft / warnSeconds; // 0 at the start of the notice, 1 when time is up
  const text = t(message || 'This screen will go back to the start in {seconds} seconds.', { seconds: secondsLeft });

  return (
    <div className="idleOverlay" role="alertdialog" aria-live="assertive" aria-label={t('Are you still there?')}>
      <div className="idleCard">
        <div className="idleRing" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="100%" height="100%">
            <circle cx="60" cy="60" r={R} className="idleTrack" />
            <circle cx="60" cy="60" r={R} className="idleArc" strokeDasharray={C} strokeDashoffset={C * used} transform="rotate(-90 60 60)" />
          </svg>
          <span className="idleNum">{secondsLeft}</span>
        </div>
        <h2>{t('Are you still there?')}</h2>
        <p>{text}</p>
        <button type="button" className="idleBtn" onClick={stay} autoFocus>
          {t("Yes, I'm still here")}
        </button>
      </div>
    </div>
  );
}
