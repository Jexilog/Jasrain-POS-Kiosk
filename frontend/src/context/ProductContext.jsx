import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAuth } from './AuthContext';

const ProductContext = createContext();

// Product shape:
// { barcode, name, price, cost, category, image, stock, critical, active, createdAt }
// (customers do not get the cost, so it is 0 on the kiosk)
const clean = (p) => ({
  barcode: String(p.barcode ?? '').trim(),
  name: String(p.name ?? '').trim(),
  price: Number(p.price) || 0,
  cost: Number(p.cost) || 0,
  category: String(p.category ?? '').trim() || 'Other',
  image: p.image || '',
  stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
  critical: Math.max(0, Math.floor(Number(p.critical) || 0)),
  active: p.active !== false,
  createdAt: p.createdAt || new Date().toISOString(),
});

// turns a failed request into the { ok, error } the forms expect
const failed = (e) => ({ ok: false, error: e.message });

export function ProductProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [log, setLog] = useState([]);
  const pRef = useRef(products);

  const refreshProducts = useCallback(async () => {
    try {
      const next = (await api.get('/products')).map(clean);
      pRef.current = next;
      setProducts(next);
    } catch (e) {
      /* the server is not reachable right now, keep what we have */
    }
  }, []);

  const refreshLog = useCallback(async () => {
    if (!isAuthenticated) {
      setLog([]);
      return;
    }
    try {
      setLog(await api.get('/stock/log'));
    } catch (e) {
      /* keep the old log */
    }
  }, [isAuthenticated]);

  // stock changes at the kiosk show up here without a refresh
  usePolling(refreshProducts, 8000, String(isAuthenticated));
  usePolling(refreshLog, 15000, String(isAuthenticated));

  const refreshAll = () => Promise.all([refreshProducts(), refreshLog()]);

  // reading
  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const categories = useMemo(() => {
    const seen = [];
    activeProducts.forEach((p) => {
      if (!seen.includes(p.category)) seen.push(p.category);
    });
    return ['All', ...seen];
  }, [activeProducts]);

  // active products only (what a customer can buy)
  const findByBarcode = (code) => {
    const c = String(code ?? '').trim();
    return pRef.current.find((p) => p.active && p.barcode === c) || null;
  };
  // including archived products
  const getProduct = (code) => {
    const c = String(code ?? '').trim();
    return pRef.current.find((p) => p.barcode === c) || null;
  };

  // stock (admin only)
  // changes: [{ barcode, delta } or { barcode, setTo }, reason, note]
  // throws if the server refuses, so the caller can show the message
  const applyMovements = async (changes) => {
    const entries = await api.post('/stock/adjust', { changes });
    await refreshAll();
    return entries;
  };

  // managing products
  const addProduct = async (data) => {
    try {
      await api.post('/products', clean({ ...data, stock: data.stock }));
      await refreshAll();
      return { ok: true };
    } catch (e) {
      return failed(e);
    }
  };

  // stock and barcode are not changed here (use Adjust stock for stock)
  const updateProduct = async (barcode, changes) => {
    const current = pRef.current.find((p) => p.barcode === barcode);
    if (!current) return { ok: false, error: 'Product not found.' };
    try {
      await api.put(`/products/${encodeURIComponent(barcode)}`, clean({ ...current, ...changes, barcode }));
      await refreshProducts();
      return { ok: true };
    } catch (e) {
      return failed(e);
    }
  };

  const setActive = async (barcode, active) => {
    try {
      await api.patch(`/products/${encodeURIComponent(barcode)}/active`, { active });
      await refreshProducts();
      return { ok: true };
    } catch (e) {
      return failed(e);
    }
  };

  const deleteProduct = async (barcode) => {
    try {
      await api.del(`/products/${encodeURIComponent(barcode)}`);
      await refreshAll();
      return { ok: true };
    } catch (e) {
      return failed(e);
    }
  };

  // rows come from parseCSV (lower-case column names)
  const importProducts = async (rows) => {
    try {
      const summary = await api.post('/products/import', { rows });
      await refreshAll();
      return summary;
    } catch (e) {
      return { added: 0, updated: 0, errors: [e.message] };
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        activeProducts,
        categories,
        log,
        findByBarcode,
        getProduct,
        refreshProducts: refreshAll,
        applyMovements,
        addProduct,
        updateProduct,
        setActive,
        deleteProduct,
        importProducts,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used inside ProductProvider');
  return context;
}
