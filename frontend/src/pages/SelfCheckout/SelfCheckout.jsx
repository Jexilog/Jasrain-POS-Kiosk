import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useKiosk } from '../../context/KioskContext';
import { imageUrl } from '../../api';
import { useCart } from '../../context/CartContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import IdleWarning from '../../components/IdleWarning';
import QuickItemModal from './components/QuickItemModal';
import QtyPadModal from './components/QtyPadModal';
import ScanBarcodeModal from './components/ScanBarcodeModal';
import CashPaymentModal from './components/CashPaymentModal';
import OrderReceipt from './components/OrderReceipt';
import CameraMonitor from './components/CameraMonitor';
import { useCameraPreview } from '../../hooks/useCameraPreview';
import { isCartRulesOn } from '../../utils/cartRules';
import { isItemCheckOn } from '../../utils/cartContents';
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

  // camera + cart model (also drives the cart rules below)
  const videoRef = useRef(null);
  const camera = useCameraPreview(videoRef);
  const cartSeen = useRef(false);
  useEffect(() => {
    if (camera.basket === 'present') cartSeen.current = true;
  }, [camera.basket]);
  // The rules only apply while the camera and model are really working, so a broken camera never locks customers out.
  // an item is still inside the basket, so Pay is held until it is scanned and taken out
  const itemLeft = isCartRulesOn() && isItemCheckOn() && camera.camera === 'ready' && camera.basket === 'present' && camera.items === 'some';
  const itemLeftRef = useRef(false);
  itemLeftRef.current = itemLeft; // always the newest answer, for the payment guards below
  const noCart = isCartRulesOn() && camera.camera === 'ready' && (camera.basket === 'empty' || camera.basket === 'unknown');
  const placingRef = useRef(false); // stops a double-tap from making two orders
  const cartRef = useRef(null);
  const prevCount = useRef(0);

  const { theme, toggleTheme, t } = useKiosk();
  const {
    cart,
    addToCart,
    addItemByBarcode,
    updateQuantity,
    removeFromCart,
    clearCart,
    total,
  } = useCart();

  // items are in the cart but no basket is seen
  const cartLeft = noCart && cart.length > 0;

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
      toast.warn(t('Only {max} in stock', { max }), { toastId: `max-${barcode}` });
      updateQuantity(barcode, max);
      return;
    }
    updateQuantity(barcode, wanted);
  };

  // check stock before taking any money
  const startPayment = () => {
    if (itemLeft || noCart) return;
    if (cart.length === 0) return;
    const short = cart.find((i) => {
      const p = getProduct(i.barcode);
      return !p || p.active === false || p.stock < i.quantity;
    });
    if (short) {
      const p = getProduct(short.barcode);
      const max = p && p.active !== false ? p.stock : 0;
      toast.error(max > 0 ? t('Only {max} of {name} left. Please change the quantity.', { max, name: short.name }) : t('{name} is no longer available.', { name: short.name }));
      if (max > 0) updateQuantity(short.barcode, max); else removeFromCart(short.barcode);
      return;
    }
    setPayOpen(true);
  };

  // Cash is in: save the paid order, empty the cart, and show the receipt
  const placeOrder = async (cash) => {
    if (placingRef.current) return;
    if (itemLeftRef.current) return; // never make an order (or receipt) while an item is still in the basket
    placingRef.current = true;
    try {
      const order = await createOrder({
        items: cart.map((i) => ({ barcode: i.barcode, quantity: i.quantity })),
        payment: 'Cash',
        cash,
      });
      clearCart();
      setPayOpen(false);
      setReceipt(order);
    } catch (err) {
      placingRef.current = false;
      toast.error(`${err.message} ${t('Please call staff.')}`);
    }
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
    if (noCart) {
      setLastScan({ ok: false, message: t('Place your basket under the camera first.'), n: Date.now() });
      return false;
    }
    const code = String(barcode).trim();
    const product = findByBarcode(code);

    if (!product) {
      const message = t('Item not found ({code}). Please ask staff for help.', { code });
      setLastScan({ ok: false, message, n: Date.now() });
      toast.error(message, { toastId: `not-found-${code}` });
      return false;
    }

    if (roomFor(product.barcode) <= 0) {
      const message = product.stock <= 0 ? t('{name} is out of stock.', { name: product.name }) : t('No more {name} in stock.', { name: product.name });
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
    if (n < qty) toast.warn(t('Only {n} of {name} left. Added {n} to cart.', { n, name: product.name }));
    else toast.success(t('{name} added to cart', { name: product.name }));
    return true;
  };

  useBarcodeScanner((scannedBarcode) => {
    tryAddBarcode(scannedBarcode);
  });

  // quick item
  const handleSelectQuickItem = (product, quantity = 1) => {
    if (noCart) {
      toast.warn(t('Place your basket under the camera first.'), { toastId: 'no-cart' });
      setIsItemPickerOpen(false);
      return;
    }
    addToCart(
      {
        barcode: product.barcode ?? String(product.id),
        name: product.name,
        price: product.price,
      },
      quantity
    );
    toast.success(t('{quantity} × {name} added to cart', { quantity, name: product.name }));
    setIsItemPickerOpen(false);
  };

  // idle timer: after 45 s without a touch it asks "Are you still there?", then clears the cart and goes home
  const idle = useIdleTimer(
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
      {/* "Are you still there?" notice with a countdown */}
      <IdleWarning idle={idle} message="Your cart will be cleared in {seconds} seconds." />

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
          <span className="checkoutTag"><Icon name="cart" size={16} /> {t('SELF CHECKOUT')}</span>
          <button className="checkoutThemeBtn" onClick={toggleTheme} aria-label="Toggle Theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
        </div>
      </header>

      {/* scanner banner  */}
      <div className="scannerBanner">
        <div className="scannerTextGroup">
          <h2 className="scannerTitle">{t('Scan Your Items Now')}</h2>
          <p className="scannerSubtitle">{noCart ? t('Place your basket to start scanning') : `${t('Subtotal')}: ₱${subtotal}`}</p>
        </div>

        {/* what the camera sees, with a basket status */}
        <CameraMonitor videoRef={videoRef} cam={camera} />
      </div>

      {itemLeft && (
        <div className="cartWarn" role="alert">
          <Icon name="alert" size={18} /> {t('There is still an item in your basket. Please scan it, then take it out.')}
        </div>
      )}

      {cartLeft && (
        <div className="cartWarn" role="alert">
          <Icon name="alert" size={18} /> {t('Your basket is not under the camera. Put it there to scan or pay.')}
        </div>
      )}

      {/* cart  */}
      <main className="cartContainer" ref={cartRef}>
        {cart.length === 0 ? (
          <div className="emptyCartState">
            <p>{t('Your cart is empty.')}</p>
            <small>{t('Please scan an item at the scanner or select an item manually.')}</small>
          </div>
        ) : (
          <ul className="cartStack">
            {cart.map((item) => {
              const info = getProduct(item.barcode);
              return (
                <li key={item.barcode} className="cartCard">
                  <div className="cartThumb" aria-hidden="true">
                    {info?.image ? <img src={imageUrl(info.image)} alt="" /> : <ProductIcon product={info} size={26} />}
                  </div>

                  <div className="cartInfo">
                    <span className="cartName">{item.name}</span>
                    <span className="cartUnit">{t('₱{n} each', { n: item.price.toFixed(2) })}</span>
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
                    <svg style={{ width: '1.375rem', height: '1.375rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            disabled={cart.length === 0 || itemLeft || noCart}
            onClick={startPayment}
          >
            <div className="payNowText">
              <span className="payTitle">{t('Finish & Pay')}</span>
              <span className="payTotal">{t('Pay Now')} (₱{subtotal})</span>
            </div>
            <div className="paymentIcons">
              <span className="payBadge card"><Icon name="cash" size={16} /> {t('Cash')}</span>
            </div>
          </button>

          <button className="actionSquareBtn addItemButton" disabled={noCart} onClick={() => setIsItemPickerOpen(true)}>
            <span className="actionIcon"><Icon name="plus" size={26} /></span>
            <span className="actionLabel">{t('Add Item')}</span>
          </button>

          <button className="actionSquareBtn manualCodeButton" disabled={noCart} onClick={() => { setLastScan(null); setIsBarcodeModalOpen(true); }}>
            <span className="actionIcon"><Icon name="scan" size={26} /></span>
            <span className="actionLabel">{t('Scan Barcode')}</span>
          </button>

          <button
            className="actionSquareBtn clearCartButton"
            onClick={clearCart}
            disabled={cart.length === 0}
            aria-label="Clear Entire Cart"
          >
            <span className="actionIcon"><Icon name="trash" size={26} /></span>
            <span className="actionLabel">{t('Clear All')}</span>
          </button>
        </div>

        <div className="secondaryActionRow">
          <button className="auxButton" onClick={() => { clearCart(); navigate('/'); }}>
            <span className="auxIcon"><Icon name="home" size={20} /></span>
            {t('Back to Menu')}
          </button>

          <button className="auxButton" onClick={() => setIsHelpModalOpen(true)}>
            <span className="auxIcon"><Icon name="help" size={20} /></span>
            {t('Get Help')}
          </button>
        </div>
      </footer>

      {/* payment  */}
      {payOpen && (
        <CashPaymentModal
          total={total}
          subtitle={t('{n} item(s) in your cart', { n: cart.reduce((n, i) => n + i.quantity, 0) })}
          blocked={itemLeft}
          blockedMessage={t('There is still an item in your basket. Take it out and scan it to continue.')}
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
            <h2 className="helpModalTitle">{t('Self Checkout Assistance')}</h2>

            <div className="helpModalBody">
              <p>
                <Icon name="pin" size={16} /> <strong>{t('Scanning Items:')}</strong> {t('Hold the item barcode 2–4 inches in front of the red scanner light below.')}
              </p>
              <p>
                <Icon name="cash" size={16} /> <strong>{t('Payment Options:')}</strong> {t('We accept cash only: coins and bills. The machine does not give change, so please ask staff if you overpay.')}
              </p>
              <p>
                <Icon name="user" size={16} /> <strong>{t('Need Assistance?')}</strong> {t('Tap "Get Help" to notify store staff.')}
              </p>
            </div>

            <button className="helpModalCloseButton" onClick={() => setIsHelpModalOpen(false)}>
              {t('Close Help')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}