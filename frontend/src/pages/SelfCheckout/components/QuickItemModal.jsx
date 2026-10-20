import React, { useMemo, useState } from 'react';
import { useProducts } from '../../../context/ProductContext';
import { useCart } from '../../../context/CartContext';
import './QuickItemModal.css';
import Icon, { ProductIcon } from '../../../components/Icon';

const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
  ['SPACE', 'CLEAR', 'DONE'],
];

const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'BACK', '0', 'DONE'];

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

function ProductPicture({ product, big }) {
  const [failed, setFailed] = useState(false);
  if (product.image && !failed) {
    return (
      <img
        className={big ? 'menuItemImg big' : 'menuItemImg'}
        src={product.image}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={big ? 'menuItemEmoji big' : 'menuItemEmoji'} aria-hidden="true">
      <ProductIcon product={product} size={big ? 64 : 34} />
    </div>
  );
}

export default function QuickItemModal({ onSelect, onClose }) {
  const { activeProducts: products, categories } = useProducts();
  const { cart } = useCart();
  // how many of an item can still be added (stock minus what is already in the cart)
  const left = (p) => Math.max(0, (p.stock ?? 0) - (cart.find((c) => c.barcode === p.barcode)?.quantity || 0));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [showKeyboard, setShowKeyboard] = useState(false);

  // quantity popup
  const [picked, setPicked] = useState(null);
  const [qtyText, setQtyText] = useState('1');
  const [showNumpad, setShowNumpad] = useState(false);
  const [fresh, setFresh] = useState(false); // first digit replaces the old number

  const maxQty = picked ? Math.max(1, Math.min(999, left(picked))) : 999;
  const qty = Math.min(maxQty, Math.max(1, parseInt(qtyText, 10) || 1));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q))
    );
  }, [query, category, products]);

  const pressKey = (key) => {
    if (key === 'BACK') setQuery((q) => q.slice(0, -1));
    else if (key === 'CLEAR') setQuery('');
    else if (key === 'SPACE') setQuery((q) => (q.endsWith(' ') ? q : q + ' '));
    else if (key === 'DONE') setShowKeyboard(false);
    else setQuery((q) => q + key.toLowerCase());
  };

  const openQuantity = (product) => {
    setShowKeyboard(false);
    setPicked(product);
    setQtyText('1');
    setShowNumpad(false);
  };

  const changeQty = (delta) => setQtyText(String(Math.min(maxQty, Math.max(1, qty + delta))));

  const openNumpad = () => {
    if (!showNumpad) setFresh(true);
    setShowNumpad(true);
  };

  const pressNumpad = (key) => {
    if (key === 'DONE') {
      setQtyText(String(qty));
      setShowNumpad(false);
      return;
    }
    if (key === 'BACK') {
      setQtyText((t) => (fresh ? '' : t.slice(0, -1)));
    } else {
      setQtyText((t) => ((fresh ? '' : t) + key).replace(/^0+/, '').slice(0, 3));
    }
    setFresh(false);
  };

  const handleQtyTyping = (e) => {
    setQtyText(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3));
    setFresh(false);
  };

  return (
    <div className="helpModalOverlay" onClick={onClose}>
      <div
        className="helpModalContent searchModalContent"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="menuTitle"
      >
        <div className="modalHeaderRow">
          <h2 id="menuTitle">Pick an Item</h2>
          <button className="closeIconBtn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>
        </div>

        {/* Tap the box and the keyboard appears */}
        <div className="searchField">
          <SearchIcon />
          <input
            className="searchInput"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowKeyboard(true)}
            onClick={() => setShowKeyboard(true)}
            placeholder="Search by name or barcode"
            inputMode="none"
            autoComplete="off"
          />
          {query && (
            <button className="searchClear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        <div className="categoryTabs">
          {categories.map((c) => (
            <button
              key={c}
              className={`categoryTab ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="menuGridItems">
          {results.length === 0 ? (
            <div className="searchEmpty">No items found</div>
          ) : (
            results.map((p) => (
              <button
                key={p.barcode}
                className={`menuItemCard ${left(p) <= 0 ? 'soldOut' : ''}`}
                onClick={() => left(p) > 0 && openQuantity(p)}
                disabled={left(p) <= 0}
              >
                <ProductPicture product={p} />
                <span className="menuItemName">{p.name}</span>
                <span className="menuItemPrice">₱{p.price.toFixed(2)}</span>
                <span className="menuItemBarcode">{left(p) <= 0 ? 'Out of stock' : p.stock <= p.critical ? `Only ${left(p)} left` : p.barcode}</span>
              </button>
            ))
          )}
        </div>

        {showKeyboard && (
          <div className="miniKeyboard">
            {KEY_ROWS.map((row, i) => (
              <div className="miniKeyRow" key={i}>
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`miniKey ${key.length > 1 ? 'wide' : ''} ${key === 'DONE' ? 'done' : ''}`}
                    onClick={() => pressKey(key)}
                  >
                    {key === 'BACK' ? '⌫' : key === 'SPACE' ? 'Space' : key === 'CLEAR' ? 'Clear' : key === 'DONE' ? 'Done' : key}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* quantity popup */}
        {picked && (
          <div className="qtyOverlay" onClick={() => setPicked(null)}>
            <div className="qtyCard" onClick={(e) => e.stopPropagation()} role="dialog">
              <ProductPicture product={picked} big />
              <h3 className="qtyName">{picked.name}</h3>
              <div className="qtyMeta">
                ₱{picked.price.toFixed(2)} each · <span className="qtyBarcode">{picked.barcode}</span>
              </div>

              <div className="qtyStepper">
                <button onClick={() => changeQty(-1)} aria-label="Less">−</button>
                <input
                  className={`qtyNumberInput ${showNumpad ? 'editing' : ''}`}
                  value={qtyText}
                  onChange={handleQtyTyping}
                  onFocus={openNumpad}
                  onClick={openNumpad}
                  onKeyDown={(e) => e.key === 'Enter' && pressNumpad('DONE')}
                  inputMode="none"
                  placeholder="1"
                  aria-label="Quantity. Tap to type a number"
                />
                <button onClick={() => changeQty(1)} aria-label="More">+</button>
              </div>
              <div className="qtyHint">Tap the number to type it</div>

              {showNumpad && (
                <div className="qtyNumpad">
                  {NUMPAD.map((key) => (
                    <button
                      key={key}
                      className={`numKey ${key === 'DONE' ? 'done' : ''}`}
                      onClick={() => pressNumpad(key)}
                    >
                      {key === 'BACK' ? '⌫' : key === 'DONE' ? 'OK' : key}
                    </button>
                  ))}
                </div>
              )}

              <div className="qtyTotal">
                <span>Total</span>
                <strong>₱{(picked.price * qty).toFixed(2)}</strong>
              </div>

              <div className="qtyActions">
                <button className="qtyCancel" onClick={() => setPicked(null)}>Cancel</button>
                <button className="qtyAdd" onClick={() => onSelect(picked, qty)}>
                  Add {qty} to cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}