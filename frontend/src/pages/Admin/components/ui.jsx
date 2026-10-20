import React, { useEffect } from 'react';
import Icon from '../../../components/Icon';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="admPageHead">
      <div>
        <h1 className="admPageTitle">{title}</h1>
        {subtitle && <p className="admPageSub">{subtitle}</p>}
      </div>
      {actions && <div className="admPageActions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`admCard ${className}`}>
      {(title || actions) && (
        <header className="admCardHead">
          <div>
            {title && <h2 className="admCardTitle">{title}</h2>}
            {subtitle && <p className="admCardSub">{subtitle}</p>}
          </div>
          {actions && <div className="admCardActions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// delta = % change (number) or null. upIsGood=false flips the color (e.g. for costs)
export function Delta({ value, upIsGood = true, label }) {
  if (value == null || !Number.isFinite(value)) {
    return label ? <span className="admDelta flat">— {label}</span> : null;
  }
  const rounded = Math.round(value);
  if (rounded === 0) return <span className="admDelta flat"><Icon name="minus" size={13} /> no change {label}</span>;
  const up = rounded > 0;
  const good = up === upIsGood;
  return (
    <span className={`admDelta ${good ? 'good' : 'bad'}`}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} /> {Math.abs(rounded)}% <span className="admDeltaLabel">{label}</span>
    </span>
  );
}

export function StatCard({ label, value, sub, delta, deltaLabel, upIsGood = true, hero = false, tone }) {
  return (
    <div className={`admStat ${hero ? 'hero' : ''} ${tone ? `tone-${tone}` : ''}`}>
      <span className="admStatLabel">{label}</span>
      <span className="admStatValue">{value}</span>
      {delta !== undefined && <Delta value={delta} upIsGood={upIsGood} label={deltaLabel} />}
      {sub && <span className="admStatSub">{sub}</span>}
    </div>
  );
}

const ICONS = { good: 'check', warn: 'alert', critical: 'x', neutral: 'dot', info: 'info' };

// status shows an icon and a word, not just color
export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`admBadge ${tone}`}>
      <span className="admBadgeIcon" aria-hidden="true"><Icon name={icon || ICONS[tone]} size={13} strokeWidth={2.5} /></span>
      {children}
    </span>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="admSeg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'active' : ''}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && <span className="admSegCount">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, hint, action }) {
  return (
    <div className="admEmpty">
      <div className="admEmptyIcon" aria-hidden="true"><Icon name={icon} size={34} /></div>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="admModalOverlay" onMouseDown={onClose}>
      <div
        className={`admModal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="admModalHead">
          <h2>{title}</h2>
          <button className="admIconBtn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        <div className="admModalBody">{children}</div>
        {footer && <footer className="admModalFoot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className={`admField ${error ? 'hasError' : ''}`}>
      <span className="admFieldLabel">{label}</span>
      {children}
      {hint && !error && <span className="admFieldHint">{hint}</span>}
      {error && <span className="admFieldError">{error}</span>}
    </label>
  );
}
