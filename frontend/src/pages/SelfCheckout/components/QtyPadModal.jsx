import React, { useEffect, useState } from 'react';
import Icon from '../../../components/Icon';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'BACK', '0', 'OK'];

export default function QtyPadModal({ name, value, onSave, onClose }) {
  const [text, setText] = useState(String(value));
  const [fresh, setFresh] = useState(true); // first digit replaces the old number

  const qty = Math.min(999, Math.max(1, parseInt(text, 10) || 1));

  const press = (key) => {
    if (key === 'OK') {
      onSave(qty);
      return;
    }
    if (key === 'BACK') setText((t) => (fresh ? '' : t.slice(0, -1)));
    else setText((t) => ((fresh ? '' : t) + key).replace(/^0+/, '').slice(0, 3));
    setFresh(false);
  };

  // physical keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('BACK');
      else if (e.key === 'Enter') press('OK');
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="qtyPadOverlay" onClick={onClose}>
      <div className="qtyPadCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Type quantity">
        <button className="qtyPadClose" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        <div className="qtyPadTitle">How many?</div>
        <div className="qtyPadItem">{name}</div>

        <div className={`qtyPadDisplay ${text ? '' : 'empty'}`}>{text || '1'}</div>

        <div className="qtyPadGrid">
          {KEYS.map((k) => (
            <button key={k} className={`qtyPadKey ${k === 'OK' ? 'ok' : ''}`} onClick={() => press(k)}>
              {k === 'BACK' ? '⌫' : k === 'OK' ? 'OK' : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}