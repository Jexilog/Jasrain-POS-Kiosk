import React, { useEffect, useMemo, useState } from 'react';
import { useProducts } from '../../../context/ProductContext';
import { useCart } from '../../../context/CartContext';
import './ScanBarcodeModal.css';
import Icon, { ProductIcon } from '../../../components/Icon';
import { useKiosk } from '../../../context/KioskContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'];

// small − 1 + control
function Stepper({ value, min = 1, max = 99, onChange, label }) {
  return (
    <div className="scanStepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Less">−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="More">+</button>
    </div>
  );
}

// Shown while the customer scans. The page listens to the scanner itself,
// so this just shows the last scan, lets them change the quantity, or type the number.
// onSubmit(code, qty) adds the item and returns true if the barcode is valid.
// onSetQty(barcode, qty) changes the quantity of an item already in the cart.
export default function ScanBarcodeModal({ lastScan, onSubmit, onSetQty, onClose }) {
  const { t } = useKiosk();
  const { activeProducts, getProduct } = useProducts();
  const { cart } = useCart();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [qty, setQty] = useState(1); // quantity for the next typed item
  const [flash, setFlash] = useState(false);


  // brief highlight on every new scan
  useEffect(() => {
    if (!lastScan) return undefined;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(timer);
  }, [lastScan]);

  // quantity of the last added item, read live from the cart
  const lastItem = lastScan && lastScan.ok ? cart.find((c) => c.barcode === lastScan.barcode) : null;
  const lastProduct = lastScan && lastScan.ok ? getProduct(lastScan.barcode) : null;
  const lastMax = lastProduct ? lastProduct.stock : 99;

  // suggestions while typing: barcodes that start with, then contain, the digits
  const suggestions = useMemo(() => {
    const c = code.trim();
    if (!c) return [];
    const starts = activeProducts.filter((p) => p.barcode.startsWith(c));
    const has = activeProducts.filter((p) => !p.barcode.startsWith(c) && p.barcode.includes(c));
    return [...starts, ...has].slice(0, 5);
  }, [code, activeProducts]);

  const press = (k) => {
    if (k === 'CLEAR') setCode('');
    else if (k === 'BACK') setCode((c) => c.slice(0, -1));
    else setCode((c) => (c.length < 16 ? c + k : c));
  };

  const add = (barcode) => {
    if (onSubmit(barcode, qty)) {
      setCode('');
      setQty(1);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const c = code.trim();
    if (c) add(c);
  };

  const result = lastScan ? (
    lastScan.ok ? (
      <div className="scanAdded">
        <span className="scanAddedText"><Icon name="check-circle" size={18} /> <b>{lastScan.name}</b> {t('added')}{lastScan.capped ? ` (${t('only {n} left', { n: lastScan.added })})` : ''}</span>
        {lastItem && (
          <span className="scanAddedQty">
            <small>{t('In cart')}</small>
            <Stepper
              value={lastItem.quantity}
              max={lastMax}
              label={`Quantity of ${lastScan.name}`}
              onChange={(n) => onSetQty(lastScan.barcode, n)}
            />
          </span>
        )}
      </div>
    ) : (
      <span><Icon name="x" size={16} /> {lastScan.message}</span>
    )
  ) : null;

  return (
    <div className="helpModalOverlay" onClick={onClose}>
      <div className="helpModalContent scanModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scan barcode">
        <div className="modalHeaderRow">
          <h2>{t('Scan Barcode')}</h2>
          <button className="closeIconBtn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        </div>

        {!typing ? (
          <>
            <div className={`scanStage ${flash ? (lastScan?.ok ? 'ok' : 'bad') : ''}`} aria-hidden="true">
              <div className="scanBars">║▌║█║▌│║▌█║▌║│█</div>
              <span className="scanBeam" />
            </div>
            <p className="scanTitle">{t('Ready to scan')}</p>
            <p className="scanHint">{t('Hold the barcode under the scanner. Scan again to add more, or use + to change the quantity.')}</p>

            <div className={`scanResult ${lastScan ? (lastScan.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
              {result || <span>{t('Waiting for an item…')}</span>}
            </div>

            <div className="modalButtonRow">
              <button type="button" onClick={() => setTyping(true)}><Icon name="keyboard" size={18} /> {t('Type the number instead')}</button>
              <button type="button" className="submitBtn" onClick={onClose}>{t('Done')}</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="barcodeDisplay">
              {code || <span className="displayPlaceholder">{t('Type the barcode number…')}</span>}
            </div>

            {/* suggestions: tap one to add it with the quantity below */}
            {code.trim() && (
              <ul className="scanSuggest" aria-label="Suggested items">
                {suggestions.length === 0 && <li className="scanSuggestNone">{t('No item starts with or contains “{code}”.', { code })}</li>}
                {suggestions.map((p) => {
                  const inCart = cart.find((c) => c.barcode === p.barcode)?.quantity || 0;
                  const out = p.stock - inCart <= 0;
                  const i = p.barcode.indexOf(code.trim());
                  return (
                    <li key={p.barcode}>
                      <button type="button" className="scanSuggestItem" onClick={() => add(p.barcode)} disabled={out}>
                        <span className="scanSuggestEmoji" aria-hidden="true"><ProductIcon product={p} size={26} /></span>
                        <span className="scanSuggestText">
                          <b>{p.name}</b>
                          <code>
                            {p.barcode.slice(0, i)}<mark>{p.barcode.slice(i, i + code.trim().length)}</mark>{p.barcode.slice(i + code.trim().length)}
                          </code>
                        </span>
                        <span className="scanSuggestPrice">{out ? t('Out of stock') : `₱${p.price.toFixed(2)}`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={`scanResult small ${lastScan ? (lastScan.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
              {result || <span>&nbsp;</span>}
            </div>

            <div className="scanQtyRow">
              <span>{t('Quantity to add')}</span>
              <Stepper value={qty} max={99} label="Quantity to add" onChange={(n) => setQty(Math.max(1, Math.min(99, n)))} />
            </div>

            <div className="numpadGrid">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`numpadBtn ${k === 'CLEAR' ? 'clearKey' : k === 'BACK' ? 'backKey' : ''}`}
                  onClick={() => press(k)}
                >
                  {k === 'BACK' ? '⌫' : k}
                </button>
              ))}
            </div>
            <div className="modalButtonRow">
              <button type="button" onClick={() => setTyping(false)}><Icon name="arrow-left" size={18} /> {t('Back to scanning')}</button>
              <button type="submit" className="submitBtn" disabled={!code.trim()}>{qty > 1 ? t('Add {n} items', { n: qty }) : t('Add Item')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
