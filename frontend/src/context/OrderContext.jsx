<<<<<<< HEAD
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateOrderNumber } from '../utils/generateOrderNumber';
import { useProducts } from './ProductContext';

const OrderContext = createContext();
const STORAGE_KEY = 'jasrain_orders';
const KEEP_LAST = 6000; // older orders are dropped so storage doesn't grow forever

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.orders)) return saved;
  } catch (e) {
    /* ignore corrupted storage */
  }
  return { orders: [], counter: 0 };
}
=======
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAuth } from './AuthContext';
import { useProducts } from './ProductContext';

const OrderContext = createContext();
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
};

// Order shape:
// { id, orderNumber, items: [{ barcode, name, price, quantity, cost, category }], total,
//   payment, status: 'Unpaid' | 'Paid' | 'Cancelled', createdAt, paidAt }
<<<<<<< HEAD
export function OrderProvider({ children }) {
  const { getProduct, applyMovements } = useProducts();
  const [orders, setOrders] = useState(() => load().orders);
  const counterRef = useRef(load().counter);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ orders: orders.slice(-KEEP_LAST), counter: counterRef.current })
      );
    } catch (e) {
      /* storage full or blocked */
    }
  }, [orders]);

  // Keep the kiosk tab and the staff tab in sync (same computer)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const fresh = load();
      counterRef.current = Math.max(counterRef.current, fresh.counter);
      setOrders(fresh.orders);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Placing an order takes the items out of stock right away
  const createOrder = ({ items, total, payment, cash }) => {
    counterRef.current += 1;
    const orderNumber = generateOrderNumber(counterRef.current);

    const enriched = items.map((i) => {
      const p = getProduct(i.barcode);
      return {
        barcode: i.barcode,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        cost: p ? p.cost : undefined,
        category: p ? p.category : undefined,
      };
    });

    applyMovements(
      enriched.map((i) => ({ barcode: i.barcode, delta: -i.quantity, reason: 'Sale', note: orderNumber })),
      'Kiosk'
    );

    const order = {
      id: Date.now() + counterRef.current,
      orderNumber,
      items: enriched,
      total,
      payment,
      // paid in the cash machine = already Paid; otherwise waits for staff
      status: cash ? 'Paid' : 'Unpaid',
      createdAt: new Date().toISOString(),
      paidAt: cash ? new Date().toISOString() : null,
      ...(cash ? { cashReceived: cash.received, change: cash.change, changeGiven: cash.change === 0 } : {}),
    };
    setOrders((list) => [...list, order]);
    return order;
  };

  const update = (orderNumber, changes) =>
    setOrders((list) =>
      list.map((o) => (o.orderNumber === orderNumber ? { ...o, ...changes } : o))
    );

  const markPaid = (orderNumber) =>
    update(orderNumber, { status: 'Paid', paidAt: new Date().toISOString() });

  // Cancelling an unpaid order puts the items back in stock
  const cancelOrder = (orderNumber) => {
    const order = orders.find((o) => o.orderNumber === orderNumber);
    if (order && order.status === 'Unpaid' && !order.demo) {
      applyMovements(
        order.items.map((i) => ({ barcode: i.barcode, delta: i.quantity, reason: 'Order cancelled', note: orderNumber })),
        'Staff'
      );
    }
    update(orderNumber, { status: 'Cancelled' });
  };

  // Staff handed the customer their change
  const giveChange = (orderNumber) => update(orderNumber, { changeGiven: true });

  const removeOrder = (orderNumber) =>
    setOrders((list) => list.filter((o) => o.orderNumber !== orderNumber));
=======
// Only staff and admin can read the list. The kiosk only places orders.
export function OrderProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { refreshProducts } = useProducts();
  const [orders, setOrders] = useState([]);

  const refreshOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setOrders(await api.get('/orders'));
    } catch (e) {
      /* keep the old list */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) setOrders([]);
  }, [isAuthenticated]);

  usePolling(refreshOrders, 5000, String(isAuthenticated));

  // The server works out the prices and the total, and takes the items out of stock.
  // Throws if the order could not be saved.
  const createOrder = async ({ items, payment, cash }) => {
    const order = await api.post('/orders', {
      items: items.map((i) => ({ barcode: i.barcode, quantity: i.quantity })),
      payment,
      cash: cash ? { received: cash.received } : null,
    });
    refreshProducts();
    refreshOrders();
    return order;
  };

  // runs a staff action, shows any error, then reloads the lists
  const act = async (request) => {
    try {
      await request();
    } catch (e) {
      toast.error(e.message);
    }
    refreshOrders();
    refreshProducts();
  };

  const path = (orderNumber) => `/orders/${encodeURIComponent(orderNumber)}`;

  const markPaid = (orderNumber) => act(() => api.post(`${path(orderNumber)}/pay`));
  // cancelling an unpaid order puts the items back in stock
  const cancelOrder = (orderNumber) => act(() => api.post(`${path(orderNumber)}/cancel`));
  // staff handed the customer their change
  const giveChange = (orderNumber) => act(() => api.post(`${path(orderNumber)}/give-change`));
  const removeOrder = (orderNumber) => act(() => api.del(path(orderNumber)));
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)

  const paidToday = orders.filter((o) => o.status === 'Paid' && isToday(o.paidAt));
  const salesToday = paidToday.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <OrderContext.Provider
      value={{
        orders,
<<<<<<< HEAD
=======
        refreshOrders,
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
        createOrder,
        markPaid,
        cancelOrder,
        giveChange,
        removeOrder,
        salesToday,
        paidTodayCount: paidToday.length,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used inside OrderProvider');
  return context;
}
