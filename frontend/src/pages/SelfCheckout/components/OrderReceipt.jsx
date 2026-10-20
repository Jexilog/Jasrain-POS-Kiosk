import React, { useEffect, useRef } from 'react';
import './CheckoutModals.css';

const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

export default function OrderReceipt({ order, onDone }) {
  // go back to the menu by itself so the next customer starts fresh
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 45000);
    return () => clearTimeout(t);
  }, []);

  const time = new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="coOverlay">
      <div className="coCard" role="dialog" aria-label="Order placed">
        <div className="coHead">
          <span className="coCheck"><CheckIcon /></span>
          <h2>Paid. Thank you!</h2>
          <p className="coMuted">Your order number</p>
          <div className="coOrderNumber">{order.orderNumber}</div>
        </div>

        <div className="coBody">
          <div className="coTear" aria-hidden="true" />

          <ul className="coLines">
            {order.items.map((it) => (
              <li key={it.barcode} className="coLine">
                <span>{it.quantity} × {it.name}</span>
                <b>₱{(it.price * it.quantity).toFixed(2)}</b>
              </li>
            ))}
          </ul>

          <div className="coGrand">
            <span className="coMuted">Total · {time}</span>
            <strong>₱{Number(order.total).toFixed(2)}</strong>
          </div>

          {order.cashReceived != null && (
            <div className="coGrand">
              <span className="coMuted">Cash inserted</span>
              <strong>₱{Number(order.cashReceived).toFixed(2)}</strong>
            </div>
          )}

          {order.change > 0 ? (
            <p className="coNote">
              <b>Change due: ₱{Number(order.change).toFixed(2)}.</b> The machine does not give change, so please
              tell the cashier your order number <b>{order.orderNumber}</b> to get it. Then take your items. Thank you!
            </p>
          ) : (
            <p className="coNote">Paid in full. Please take your items. Thank you!</p>
          )}
        </div>

        <div className="coActions">
          <button className="coBtn primary" onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
