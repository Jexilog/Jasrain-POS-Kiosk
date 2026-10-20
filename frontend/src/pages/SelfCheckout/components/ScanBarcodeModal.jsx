import React, { useEffect, useMemo, useState } from 'react';
import { useProducts } from '../../../context/ProductContext';
import { useCart } from '../../../context/CartContext';
import { SCAN_MODE } from '../../../utils/cash';
import './ScanBarcodeModal.css';
import Icon, { ProductIcon } from '../../../components/Icon';

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
  const { activeProducts, getProduct } = useProducts();
  const { cart } = useCart();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [qty, setQty] = useState(1); // quantity for the next typed item
  const [flash, setFlash] = useState(false);

  const mock = (barcode) => onSubmit(barcode, 1);
  const randomItem = () => {
    const list = activeProducts.filter((p) => p.stock > 0);
    if (list.length) mock(list[Math.floor(Math.random() * list.length)].barcode);
  };

  // brief highlight on every new scan
  useEffect(() => {
    if (!lastScan) return undefined;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
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
        <span className="scanAddedText"><Icon name="check-circle" size={18} /> <b>{lastScan.name}</b> added{lastScan.capped ? ` (only ${lastScan.added} left)` : ''}</span>
        {lastItem && (
          <span className="scanAddedQty">
            <small>In cart</small>
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
          <h2>Scan Barcode</h2>
          <button className="closeIconBtn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        </div>

        {!typing ? (
          <>
            <div className={`scanStage ${flash ? (lastScan?.ok ? 'ok' : 'bad') : ''}`} aria-hidden="true">
              <div className="scanBars">║▌║█║▌│║▌█║▌║│█</div>
              <span className="scanBeam" />
            </div>
            <p className="scanTitle">Ready to scan</p>
            <p className="scanHint">Hold the barcode under the scanner. Scan again to add more, or use + to change the quantity.</p>

            <div className={`scanResult ${lastScan ? (lastScan.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
              {result || <span>Waiting for an item…</span>}
            </div>

            {SCAN_MODE === 'simulator' && (
              <div className="mockScan">
                <span className="mockTag">TEST MODE · mock scan</span>
                <div className="mockRow">
                  <button type="button" className="mockBtn main" onClick={randomItem}><Icon name="shuffle" size={18} /> Scan a random item</button>
                  <button type="button" className="mockBtn" onClick={() => mock('0000000000000')}><Icon name="x" size={18} /> Scan unknown code</button>
                </div>
                <div className="mockChips">
                  {activeProducts.map((p) => (
                    <button key={p.barcode} type="button" className="mockChip" onClick={() => mock(p.barcode)} disabled={p.stock <= 0} title={p.barcode}>
                      <ProductIcon product={p} size={18} /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modalButtonRow">
              <button type="button" onClick={() => setTyping(true)}><Icon name="keyboard" size={18} /> Type the number instead</button>
              <button type="button" className="submitBtn" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="barcodeDisplay">
              {code || <span className="displayPlaceholder">Type the barcode number…</span>}
            </div>

            {/* suggestions: tap one to add it with the quantity below */}
            {code.trim() && (
              <ul className="scanSuggest" aria-label="Suggested items">
                {suggestions.length === 0 && <li className="scanSuggestNone">No item starts with or contains “{code}”.</li>}
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
                        <span className="scanSuggestPrice">{out ? 'Out of stock' : `₱${p.price.toFixed(2)}`}</span>
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
              <span>Quantity to add</span>
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
              <button type="button" onClick={() => setTyping(false)}><Icon name="arrow-left" size={18} /> Back to scanning</button>
              <button type="submit" className="submitBtn" disabled={!code.trim()}>Add {qty > 1 ? `${qty} items` : 'Item'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
