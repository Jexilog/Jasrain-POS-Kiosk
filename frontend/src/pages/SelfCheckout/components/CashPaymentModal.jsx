import React from 'react';
import { useCashSession } from '../../../hooks/useCashSession';
import { CASH_MODE, COINS, BILLS } from '../../../utils/cash';
import './CheckoutModals.css';
import Icon from '../../../components/Icon';

const peso = (n) => `₱${Number(n).toFixed(2)}`;

// Customer inserts coins and bills until the total is covered.
// onPaid({ received, change, log }) runs once after the total is reached.
export default function CashPaymentModal({ total, subtitle, onPaid, onClose }) {
  const cash = useCashSession(total, onPaid);
  const started = cash.inserted > 0;
  const pct = Math.min(100, Math.round((cash.inserted / total) * 100));

  return (
    <div className="coOverlay">
      <div className="coCard" role="dialog" aria-label="Insert cash">
        <div className="coHead">
          <h2>{cash.complete ? 'Payment received' : 'Insert cash'}</h2>
          <p className="coMuted">{subtitle || 'Feed coins and bills into the machine'}</p>
        </div>

        <div className="coBody">
          <div className="coTotalBox">
            <span className="coLabel">Total to pay</span>
            <strong>{peso(total)}</strong>
          </div>

          <div className="coCash" aria-live="polite">
            <div className="coCashRow">
              <span className="coLabel">Inserted</span>
              <strong className="coCashNum">{peso(cash.inserted)}</strong>
            </div>
            <div className="coBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
            {cash.complete ? (
              <p className="coCashMsg good">
                <Icon name="check-circle" size={20} /> Thank you!{cash.change > 0 && <> Your change is <b>{peso(cash.change)}</b>. The machine does not give change, so please ask staff at the counter.</>}
              </p>
            ) : (
              <p className="coCashMsg">
                {started ? <>Still to pay <b>{peso(cash.remaining)}</b></> : 'Waiting for cash…'}
              </p>
            )}
          </div>

          {!cash.complete && (
            <p className="coNote">
              Coins: ₱{COINS.join(', ₱')} · Bills: ₱{BILLS.join(', ₱')}.<br />
              The machine cannot give change. Overpaying means asking staff for the difference.
            </p>
          )}

          {CASH_MODE === 'simulator' && !cash.complete && (
            <div className="coSim">
              <span className="coSimTag">TEST MODE · pretend to insert</span>
              <div className="coSimRow">
                {COINS.map((v) => (
                  <button key={`c${v}`} className="coSimBtn coin" onClick={() => cash.accept(v, 'coin')}>₱{v}</button>
                ))}
              </div>
              <div className="coSimRow">
                {BILLS.map((v) => (
                  <button key={`b${v}`} className="coSimBtn bill" onClick={() => cash.accept(v, 'bill')}>₱{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="coActions">
          <button className="coBtn" onClick={onClose} disabled={started}>Back</button>
        </div>
        {started && !cash.complete && (
          <p className="coNote" style={{ padding: '0 1.5rem 1.2rem' }}>
            Cash already inserted cannot be returned. Please finish paying, or ask staff for help.
          </p>
        )}
      </div>
    </div>
  );
}
