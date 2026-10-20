import React, { useState } from 'react';
import './CheckoutModals.css';

const METHODS = [
  { id: 'Cash at counter', icon: '💵', label: 'Pay at counter', hint: 'Cash — pay the cashier with your order number', enabled: true },
  { id: 'GCash', icon: '📱', label: 'GCash', hint: 'Scan a QR code', enabled: false },
  { id: 'Card', icon: '💳', label: 'Card', hint: 'Debit or credit', enabled: false },
];

export default function PaymentModal({ total, itemCount, onConfirm, onClose }) {
  const [method, setMethod] = useState('Cash at counter');

  return (
    <div className="coOverlay" onClick={onClose}>
      <div className="coCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose how to pay">
        <div className="coHead">
          <h2>How would you like to pay?</h2>
          <p className="coMuted">{itemCount} item{itemCount === 1 ? '' : 's'} in your cart</p>
        </div>

        <div className="coBody">
          <div className="coTotalBox">
            <span className="coLabel">Total to pay</span>
            <strong>₱{total.toFixed(2)}</strong>
          </div>

          <div className="coMethods" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={method === m.id}
                disabled={!m.enabled}
                className={`coMethod ${method === m.id ? 'active' : ''}`}
                onClick={() => setMethod(m.id)}
              >
                <span className="coMethodIcon" aria-hidden="true">{m.icon}</span>
                <span className="coMethodText">
                  <strong>{m.label}</strong>
                  <span>{m.hint}</span>
                </span>
                {!m.enabled && <span className="coSoon">Coming soon</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="coActions">
          <button className="coBtn" onClick={onClose}>Back</button>
          <button className="coBtn primary" onClick={() => onConfirm(method)}>
            Place order · ₱{total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
