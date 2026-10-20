import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { useCart } from '../../context/CartContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import QuickItemModal from './components/QuickItemModal';
import QtyPadModal from './components/QtyPadModal';
import ScanBarcodeModal from './components/ScanBarcodeModal';
import CashPaymentModal from './components/CashPaymentModal';
import OrderReceipt from './components/OrderReceipt';
import { useOrders } from '../../context/OrderContext';
import { useProducts } from '../../context/ProductContext';

import './SelfCheckout.css';
import Icon, { ProductIcon } from '../../components/Icon';

export default function SelfCheckout() {
  const navigate = useNavigate();

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [lastScan, setLastScan] = useState(null); // result shown inside the scan modal
  const [qtyEdit, setQtyEdit] = useState(null); // cart item whose quantity is being typed
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const placingRef = useRef(false); // stops a double-tap from making two orders
  const cartRef = useRef(null);
  const prevCount = useRef(0);

  const { theme, toggleTheme } = useKiosk();
  const {
    cart,
    addToCart,
    addItemByBarcode,
    updateQuantity,
    removeFromCart,
    clearCart,
    total,
  } = useCart();

  const { createOrder } = useOrders();
  const { findByBarcode, getProduct } = useProducts();

  // how many more of this item can go in the cart
  const roomFor = (barcode) => {
    const p = getProduct(barcode);
    if (!p) return 0;
    const inCart = cart.find((c) => c.barcode === barcode)?.quantity || 0;
    return Math.max(0, p.stock - inCart);
  };
  // set a quantity but never above what is in stock
  const setQty = (barcode, wanted) => {
    const p = getProduct(barcode);
    const max = p ? p.stock : wanted;
    if (wanted > max) {
      toast.warn(`Only ${max} in stock`, { toastId: `max-${barcode}` });
      updateQuantity(barcode, max);
      return;
    }
    updateQuantity(barcode, wanted);
  };

  // check stock before taking any money
  const startPayment = () => {
    if (cart.length === 0) return;
    const short = cart.find((i) => {
      const p = getProduct(i.barcode);
      return !p || p.active === false || p.stock < i.quantity;
    });
    if (short) {
      const p = getProduct(short.barcode);
      const max = p && p.active !== false ? p.stock : 0;
      toast.error(max > 0 ? `Only ${max} of ${short.name} left. Please change the quantity.` : `${short.name} is no longer available.`);
      if (max > 0) updateQuantity(short.barcode, max); else removeFromCart(short.barcode);
      return;
    }
    setPayOpen(true);
  };

  // Cash is in: save the paid order, empty the cart, and show the receipt
  const placeOrder = (cash) => {
    if (placingRef.current) return;
    placingRef.current = true;
    const order = createOrder({
      items: cart.map((i) => ({
        barcode: i.barcode,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      total,
      payment: 'Cash',
      cash,
    });
    clearCart();
    setPayOpen(false);
    setReceipt(order);
  };

  const finishReceipt = () => {
    placingRef.current = false;
    setReceipt(null);
    navigate('/');
  };

  // Scroll to the newest item when something is added
  useEffect(() => {
    if (cart.length > prevCount.current && cartRef.current) {
      cartRef.current.scrollTo({ top: cartRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCount.current = cart.length;
  }, [cart.length]);

  // barcode scanner
  // Only barcodes that exist in products.js can be added. Anything else is rejected.
  const tryAddBarcode = (barcode, qty = 1) => {
    if (payOpen || receipt) return false; // ignore scans while paying
    const code = String(barcode).trim();
    const product = findByBarcode(code);

    if (!product) {
      const message = `Item not found (${code}). Please ask staff for help.`;
      setLastScan({ ok: false, message, n: Date.now() });
      toast.error(message, { toastId: `not-found-${code}` });
      return false;
    }

    if (roomFor(product.barcode) <= 0) {
      const message = product.stock <= 0 ? `${product.name} is out of stock.` : `No more ${product.name} in stock.`;
      setLastScan({ ok: false, message, n: Date.now() });
      toast.error(message, { toastId: `oos-${code}` });
      return false;
    }

    // never add more than what is left on the shelf
    const room = roomFor(product.barcode);
    const n = Math.max(1, Math.min(qty, room));
    addToCart({
      barcode: product.barcode,
      name: product.name,
      price: product.price,
    }, n);
    setLastScan({
      ok: true,
      barcode: product.barcode,
      name: product.name,
      added: n,
      capped: n < qty,
      n: Date.now(),
    });
    if (n < qty) toast.warn(`Only ${n} of ${product.name} left. Added ${n} to cart.`);
    else toast.success(`${product.name} added to cart`);
    return true;
  };

  useBarcodeScanner((scannedBarcode) => {
    tryAddBarcode(scannedBarcode);
  });

  // quick item
  const handleSelectQuickItem = (product, quantity = 1) => {
    addToCart(
      {
        barcode: product.barcode ?? String(product.id),
        name: product.name,
        price: product.price,
      },
      quantity
    );
    toast.success(`${quantity} × ${product.name} added to cart`);
    setIsItemPickerOpen(false);
  };

  // idle timer
  useIdleTimer(
    60000,
    () => {
      clearCart();
      navigate('/');
    },
    !payOpen // never reset the cart while someone is paying
  );

  const subtotal = total.toFixed(2);

  return (
    <div className={`checkoutScreen ${theme}Mode`}>
      {/* header  */}
      <header className="checkoutHeader">
        <div className="brandBadge">
          <div className="brandLogo">J</div>
          <div>
            <h1 className="checkoutBrandTitle">JASRAIN</h1>
            <span className="checkoutBrandSubtitle">STORE &amp; COMPUTER SHOP</span>
          </div>
        </div>

        <div className="headerActions">
          <span className="checkoutTag"><Icon name="cart" size={16} /> SELF CHECKOUT</span>
          <button className="checkoutThemeBtn" onClick={toggleTheme} aria-label="Toggle Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
        </div>
      </header>

      {/* scanner banner  */}
      <div className="scannerBanner">
        <div className="scannerTextGroup">
          <h2 className="scannerTitle">Scan Your Items Now</h2>
          <p className="scannerSubtitle">Subtotal: ₱{subtotal}</p>
        </div>

        <div className="barcodeGraphic" aria-hidden="true">
          <span className="arrowGraphic"><Icon name="arrow-right" size={28} /></span>
          <div className="barcodeIcon">
            <span className="scanLine"></span>
            ║▌║█║▌│
          </div>
        </div>
      </div>

      {/* cart  */}
      <main className="cartContainer" ref={cartRef}>
        {cart.length === 0 ? (
          <div className="emptyCartState">
            <p>Your cart is empty.</p>
            <small>Please scan an item at the scanner or select an item manually.</small>
          </div>
        ) : (
          <ul className="cartStack">
            {cart.map((item) => {
              const info = getProduct(item.barcode);
              return (
                <li key={item.barcode} className="cartCard">
                  <div className="cartThumb" aria-hidden="true">
                    {info?.image ? <img src={info.image} alt="" /> : <ProductIcon product={info} size={26} />}
                  </div>

                  <div className="cartInfo">
                    <span className="cartName">{item.name}</span>
                    <span className="cartUnit">₱{item.price.toFixed(2)} each</span>
                  </div>

                  <div className="qtyPill">
                    <button
                      className="qtyPillBtn"
                      onClick={() => updateQuantity(item.barcode, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <button
                      className="qtyPillNum"
                      onClick={() => setQtyEdit(item)}
                      aria-label={`Quantity ${item.quantity}. Tap to type a number`}
                    >
                      {item.quantity}
                    </button>
                    <button
                      className="qtyPillBtn"
                      onClick={() => setQty(item.barcode, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <span className="cartLine">₱{(item.price * item.quantity).toFixed(2)}</span>

                  <button
                    className="cartRemove"
                    onClick={() => removeFromCart(item.barcode)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* footer / actions  */}
      <footer className="checkoutFooter">
        <div className="primaryActionRow">
          <button
            className="payNowButton"
            disabled={cart.length === 0}
            onClick={startPayment}
          >
            <div className="payNowText">
              <span className="payTitle">Finish &amp; Pay</span>
              <span className="payTotal">Pay Now (₱{subtotal})</span>
            </div>
            <div className="paymentIcons">
              <span className="payBadge card"><Icon name="cash" size={16} /> Cash</span>
            </div>
          </button>

          <button className="actionSquareBtn addItemButton" onClick={() => setIsItemPickerOpen(true)}>
            <span className="actionIcon"><Icon name="plus" size={26} /></span>
            <span className="actionLabel">Add Item</span>
          </button>

          <button className="actionSquareBtn manualCodeButton" onClick={() => { setLastScan(null); setIsBarcodeModalOpen(true); }}>
            <span className="actionIcon"><Icon name="scan" size={26} /></span>
            <span className="actionLabel">Scan Barcode</span>
          </button>

          <button
            className="actionSquareBtn clearCartButton"
            onClick={clearCart}
            disabled={cart.length === 0}
            aria-label="Clear Entire Cart"
          >
            <span className="actionIcon"><Icon name="trash" size={26} /></span>
            <span className="actionLabel">Clear All</span>
          </button>
        </div>

        <div className="secondaryActionRow">
          <button className="auxButton" onClick={() => { clearCart(); navigate('/'); }}>
            <span className="auxIcon"><Icon name="home" size={20} /></span>
            Back to Menu
          </button>

          <button className="auxButton" onClick={() => setIsHelpModalOpen(true)}>
            <span className="auxIcon"><Icon name="help" size={20} /></span>
            Get Help
          </button>
        </div>
      </footer>

      {/* payment  */}
      {payOpen && (
        <CashPaymentModal
          total={total}
          subtitle={`${cart.reduce((n, i) => n + i.quantity, 0)} item(s) in your cart`}
          onPaid={placeOrder}
          onClose={() => setPayOpen(false)}
        />
      )}

      {/* order receipt  */}
      {receipt && <OrderReceipt order={receipt} onDone={finishReceipt} />}

      {/* type quantity modal  */}
      {qtyEdit && (
        <QtyPadModal
          name={qtyEdit.name}
          value={qtyEdit.quantity}
          onSave={(n) => {
            setQty(qtyEdit.barcode, n);
            setQtyEdit(null);
          }}
          onClose={() => setQtyEdit(null)}
        />
      )}

      {/* quick item modal  */}
      {isItemPickerOpen && (
        <QuickItemModal
          onSelect={handleSelectQuickItem}
          onClose={() => setIsItemPickerOpen(false)}
        />
      )}

      {/* scan barcode modal  */}
      {isBarcodeModalOpen && (
        <ScanBarcodeModal
          lastScan={lastScan}
          onSubmit={tryAddBarcode}
          onSetQty={setQty}
          onClose={() => setIsBarcodeModalOpen(false)}
        />
      )}

      {/* help modal  */}
      {isHelpModalOpen && (
        <div className="helpModalOverlay" onClick={() => setIsHelpModalOpen(false)}>
          <div className="helpModalContent" onClick={(e) => e.stopPropagation()} role="dialog">
            <h2 className="helpModalTitle">Self Checkout Assistance</h2>

            <div className="helpModalBody">
              <p>
                <Icon name="pin" size={16} /> <strong>Scanning Items:</strong> Hold the item barcode 2–4 inches in front of
                the red scanner light below.
              </p>
              <p>
                <Icon name="cash" size={16} /> <strong>Payment Options:</strong> We accept cash only: coins and bills. The machine does not give change, so please ask staff if you overpay.
                Debit/Credit cards.
              </p>
              <p>
                <Icon name="user" size={16} /> <strong>Need Assistance?</strong> Tap "Get Help" to notify store staff.
              </p>
            </div>

            <button className="helpModalCloseButton" onClick={() => setIsHelpModalOpen(false)}>
              Close Help
            </button>
          </div>
        </div>
      )}
    </div>
  );
}