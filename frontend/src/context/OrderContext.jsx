import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAuth } from './AuthContext';
import { useProducts } from './ProductContext';

const OrderContext = createContext();

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

  const paidToday = orders.filter((o) => o.status === 'Paid' && isToday(o.paidAt));
  const salesToday = paidToday.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <OrderContext.Provider
      value={{
        orders,
        refreshOrders,
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
