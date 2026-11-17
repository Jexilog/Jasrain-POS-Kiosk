import React from 'react';
import { useCashSession } from '../../../hooks/useCashSession';
import { CASH_MODE, COINS, BILLS } from '../../../utils/cash';
import './CheckoutModals.css';
import './CashCount.css';
import Icon from '../../../components/Icon';
import { useKiosk } from '../../../context/KioskContext';

const peso = (n) => `₱${Number(n).toFixed(2)}`;

// What went in so far, as counts: "₱5 coin x 2". Coins first, then bills, smallest first.
function countInserted(log) {
  const groups = {};
  for (const e of log || []) {
    const key = `${e.kind}:${e.amount}`;
    groups[key] = groups[key] || { kind: e.kind, amount: e.amount, n: 0 };
    groups[key].n += 1;
  }
  const rows = Object.values(groups).sort((a, b) => (a.kind === b.kind ? a.amount - b.amount : a.kind === 'coin' ? -1 : 1));
  const coins = rows.filter((r) => r.kind === 'coin').reduce((sum, r) => sum + r.n, 0);
  const bills = rows.filter((r) => r.kind === 'bill').reduce((sum, r) => sum + r.n, 0);
  return { rows, coins, bills };
}

// Customer inserts coins and bills until the total is covered.
// onPaid({ received, change, log }) runs once after the total is reached.
export default function CashPaymentModal({ total, subtitle, blocked = false, blockedMessage = '', onPaid, onClose }) {
  const { t } = useKiosk();
  const cash = useCashSession(total, onPaid, blocked);
  const started = cash.inserted > 0;
  const pct = Math.min(100, Math.round((cash.inserted / total) * 100));
  const count = countInserted(cash.log);

  return (
    <div className="coOverlay">
      <div className="coCard" role="dialog" aria-label="Insert cash">
        <div className="coHead">
          <h2>{cash.complete ? t('Payment received') : t('Insert cash')}</h2>
          <p className="coMuted">{subtitle || t('Feed coins and bills into the machine')}</p>
        </div>

        <div className="coBody">
          {blocked && (
            <p className="coCashMsg" role="alert" style={{ color: '#dc2626', fontWeight: 700 }}>
              <Icon name="alert" size={20} /> {blockedMessage}
            </p>
          )}
          <div className="coTotalBox">
            <span className="coLabel">{t('Total to pay')}</span>
            <strong>{peso(total)}</strong>
          </div>

          <div className="coCash" aria-live="polite">
            <div className="coCashRow">
              <span className="coLabel">{t('Inserted')}</span>
              <strong className="coCashNum">{peso(cash.inserted)}</strong>
            </div>
            {started && (
              <div className="coCount">
                <div className="coCountTotals">
                  <span>{t('Coins')}: <b>{count.coins}</b></span>
                  <span>{t('Bills')}: <b>{count.bills}</b></span>
                </div>
                <div className="coCountChips">
                  {count.rows.map((r) => (
                    <span key={`${r.kind}${r.amount}`} className={`coChip ${r.kind}`}>
                      ₱{r.amount} {r.kind === 'coin' ? t('coin') : t('bill')} × {r.n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="coBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
            {cash.complete && !blocked ? (
              <p className="coCashMsg good">
                <Icon name="check-circle" size={20} /> {t('Thank you!')}{cash.change > 0 && <> {t('Your change is')} <b>{peso(cash.change)}</b>. {t('The machine does not give change, so please ask staff at the counter.')}</>}
              </p>
            ) : (
              <p className="coCashMsg">
                {started ? <>{t('Still to pay')} <b>{peso(cash.remaining)}</b></> : t('Waiting for cash…')}
              </p>
            )}
          </div>

          {!cash.complete && (
            <p className="coNote">
              {t('Coins:')} ₱{COINS.join(', ₱')} · {t('Bills:')} ₱{BILLS.join(', ₱')}.<br />
              {t('The machine cannot give change. Overpaying means asking staff for the difference.')}
            </p>
          )}

          {CASH_MODE === 'simulator' && !cash.complete && (
            <div className="coSim">
              <span className="coSimTag">TEST MODE · pretend to insert</span>
              <div className="coSimRow">
                {COINS.map((v) => (
                  <button key={`c${v}`} className="coSimBtn coin" onClick={() => cash.accept(v, 'coin')} disabled={blocked}>₱{v}</button>
                ))}
              </div>
              <div className="coSimRow">
                {BILLS.map((v) => (
                  <button key={`b${v}`} className="coSimBtn bill" onClick={() => cash.accept(v, 'bill')} disabled={blocked}>₱{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="coActions">
          <button className="coBtn" onClick={onClose} disabled={started}>{t('Back')}</button>
        </div>
        {started && !cash.complete && (
          <p className="coNote" style={{ padding: '0 1.5rem 1.2rem' }}>
            {t('Cash already inserted cannot be returned. Please finish paying, or ask staff for help.')}
          </p>
        )}
      </div>
    </div>
  );
}
