import React, { useEffect, useRef, useState } from 'react';
import { printReceipt, reprintReceipt, connectPrinter } from '../../../utils/printer';
import './CheckoutModals.css';
import { useKiosk } from '../../../context/KioskContext';

const CheckIcon = () => (
  <svg style={{ width: '2rem', height: '2rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

export default function OrderReceipt({ order, onDone }) {
  const { t } = useKiosk();
  // go back to the menu by itself so the next customer starts fresh
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), 45000);
    return () => clearTimeout(timer);
  }, []);

  // print the paper receipt once, as soon as the order is shown
  const [printError, setPrintError] = useState('');
  useEffect(() => {
    printReceipt(order).then((r) => setPrintError(r.ok ? '' : r.error));
  }, [order]);
  // if the printer is not connected, this button opens the picker once, then prints
  const printAgain = async () => {
    let r = await reprintReceipt(order);
    if (!r.ok) {
      const c = await connectPrinter();
      r = c.ok ? await reprintReceipt(order) : c; // show the real reason if connecting failed
    }
    setPrintError(r.ok ? '' : r.error);
  };

  const time = new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="coOverlay">
      <div className="coCard" role="dialog" aria-label="Order placed">
        <div className="coHead">
          <span className="coCheck"><CheckIcon /></span>
          <h2>{t('Paid. Thank you!')}</h2>
          <p className="coMuted">{t('Your order number')}</p>
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
            <span className="coMuted">{t('Total')} · {time}</span>
            <strong>₱{Number(order.total).toFixed(2)}</strong>
          </div>

          {order.cashReceived != null && (
            <div className="coGrand">
              <span className="coMuted">{t('Cash inserted')}</span>
              <strong>₱{Number(order.cashReceived).toFixed(2)}</strong>
            </div>
          )}

          {order.change > 0 ? (
            <p className="coNote">
              <b>{t('Change due')}: ₱{Number(order.change).toFixed(2)}.</b> {t('The machine does not give change, so please tell the cashier your order number')} <b>{order.orderNumber}</b> {t('to get it. Then take your items. Thank you!')}
            </p>
          ) : (
            <p className="coNote">{t('Paid in full. Please take your items. Thank you!')}</p>
          )}
        </div>

        {printError && <p className="coNote">{printError} {t('Please take a photo of this screen or ask the cashier for a receipt.')}</p>}

        <div className="coActions">
          <button className="coBtn" onClick={printAgain}>{t('Print receipt')}</button>
          <button className="coBtn primary" onClick={onDone}>{t('Done')}</button>
        </div>
      </div>
    </div>
  );
}
