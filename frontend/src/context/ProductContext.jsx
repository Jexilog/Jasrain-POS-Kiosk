<<<<<<< HEAD
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { products as seed } from '../utils/products';

const ProductContext = createContext();
const PKEY = 'jasrain_products';
const MKEY = 'jasrain_stock_log';
const LOG_KEEP = 3000;

// Product shape:
// { barcode, name, price, cost, category, image, stock, critical, active, createdAt }
=======
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePolling } from '../hooks/usePolling';
import { useAuth } from './AuthContext';

const ProductContext = createContext();

// Product shape:
// { barcode, name, price, cost, category, image, stock, critical, active, createdAt }
// (customers do not get the cost, so it is 0 on the kiosk)
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
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

<<<<<<< HEAD
function loadProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(PKEY));
    if (Array.isArray(saved)) return saved.map(clean);
  } catch (e) {
    /* fall back to the starter list */
  }
  return seed.map(clean);
}

function loadLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(MKEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {
    /* empty */
  }
  return [];
}

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(loadProducts);
  const [log, setLog] = useState(loadLog);

  // refs hold the latest data, so changes made at the same time
  // (like a 3-item order) stack instead of overwriting each other
  const pRef = useRef(products);
  const lRef = useRef(log);

  const commitProducts = (next) => {
    pRef.current = next;
    setProducts(next);
  };
  const commitLog = (entries) => {
    if (!entries.length) return;
    const next = [...lRef.current, ...entries].slice(-LOG_KEEP);
    lRef.current = next;
    setLog(next);
  };

  useEffect(() => {
    try {
      localStorage.setItem(PKEY, JSON.stringify(products));
    } catch (e) {
      /* storage blocked */
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(MKEY, JSON.stringify(log));
    } catch (e) {
      /* storage blocked */
    }
  }, [log]);

  // keep the kiosk tab and the admin tab in sync (same computer)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === PKEY) {
        const next = loadProducts();
        pRef.current = next;
        setProducts(next);
      }
      if (e.key === MKEY) {
        const next = loadLog();
        lRef.current = next;
        setLog(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

=======
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

>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
  // reading
  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const categories = useMemo(() => {
    const seen = [];
    activeProducts.forEach((p) => {
      if (!seen.includes(p.category)) seen.push(p.category);
    });
    return ['All', ...seen];
  }, [activeProducts]);

<<<<<<< HEAD
  // newest data, active products only (what a customer can buy)
=======
  // active products only (what a customer can buy)
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
  const findByBarcode = (code) => {
    const c = String(code ?? '').trim();
    return pRef.current.find((p) => p.active && p.barcode === c) || null;
  };
<<<<<<< HEAD
  // newest data, including archived products
=======
  // including archived products
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
  const getProduct = (code) => {
    const c = String(code ?? '').trim();
    return pRef.current.find((p) => p.barcode === c) || null;
  };

<<<<<<< HEAD
  // stock
  // changes: [{ barcode, delta } or { barcode, setTo }, reason, note]
  const applyMovements = (changes, by = 'Admin') => {
    let next = pRef.current;
    const entries = [];
    changes.forEach((c) => {
      const idx = next.findIndex((p) => p.barcode === c.barcode);
      if (idx < 0) return;
      const p = next[idx];
      const target =
        c.setTo != null
          ? Math.max(0, Math.floor(Number(c.setTo)))
          : Math.max(0, p.stock + Math.round(Number(c.delta)));
      const delta = target - p.stock;
      if (delta === 0) return;
      next = next.map((x, i) => (i === idx ? { ...x, stock: target } : x));
      entries.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        barcode: p.barcode,
        name: p.name,
        delta,
        stockAfter: target,
        reason: c.reason || 'Adjustment',
        note: c.note || '',
        by,
      });
    });
    if (entries.length) {
      commitProducts(next);
      commitLog(entries);
    }
=======
  // stock (admin only)
  // changes: [{ barcode, delta } or { barcode, setTo }, reason, note]
  // throws if the server refuses, so the caller can show the message
  const applyMovements = async (changes) => {
    const entries = await api.post('/stock/adjust', { changes });
    await refreshAll();
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
    return entries;
  };

  // managing products
<<<<<<< HEAD
  const validate = (p, ignoreBarcode) => {
    if (!p.name) return 'Please enter a product name.';
    if (!p.barcode) return 'Please enter a barcode (or tap Generate).';
    if (!(p.price > 0)) return 'Price must be more than 0.';
    if (p.cost < 0) return 'Cost cannot be negative.';
    const clash = pRef.current.find((x) => x.barcode === p.barcode && x.barcode !== ignoreBarcode);
    if (clash) return `That barcode is already used by "${clash.name}".`;
    return null;
  };

  const addProduct = (data) => {
    const p = clean({ ...data, stock: 0 });
    const error = validate(p);
    if (error) return { ok: false, error };
    commitProducts([...pRef.current, p]);
    const initial = Math.max(0, Math.floor(Number(data.stock) || 0));
    if (initial > 0) applyMovements([{ barcode: p.barcode, setTo: initial, reason: 'Initial stock' }], 'Admin');
    return { ok: true };
  };

  // stock and barcode are not changed here (use Adjust stock for stock)
  const updateProduct = (barcode, changes) => {
    const current = pRef.current.find((p) => p.barcode === barcode);
    if (!current) return { ok: false, error: 'Product not found.' };
    const merged = clean({ ...current, ...changes, barcode: current.barcode, stock: current.stock });
    const error = validate(merged, barcode);
    if (error) return { ok: false, error };
    commitProducts(pRef.current.map((p) => (p.barcode === barcode ? merged : p)));
    return { ok: true };
  };

  const setActive = (barcode, active) =>
    commitProducts(pRef.current.map((p) => (p.barcode === barcode ? { ...p, active } : p)));

  const deleteProduct = (barcode) => commitProducts(pRef.current.filter((p) => p.barcode !== barcode));

  // rows come from parseCSV (lower-case column names)
  const importProducts = (rows) => {
    const summary = { added: 0, updated: 0, errors: [] };
    rows.forEach((r, i) => {
      const line = i + 2;
      const barcode = String(r.barcode ?? '').trim();
      const name = String(r.name ?? '').trim();
      const price = Number(r.price);
      if (!barcode || !name || !(price > 0)) {
        summary.errors.push(`Row ${line}: needs a barcode, a name and a price above 0`);
        return;
      }
      const has = (k) => r[k] !== undefined && r[k] !== '';
      const existing = pRef.current.find((p) => p.barcode === barcode);

      if (existing) {
        const merged = clean({
          ...existing,
          name,
          price,
          cost: has('cost') ? r.cost : existing.cost,
          category: has('category') ? r.category : existing.category,
          critical: has('critical') ? r.critical : existing.critical,
          stock: existing.stock,
        });
        commitProducts(pRef.current.map((p) => (p.barcode === barcode ? merged : p)));
        summary.updated += 1;
      } else {
        commitProducts([
          ...pRef.current,
          clean({
            barcode, name, price,
            cost: r.cost, category: r.category, critical: r.critical, stock: 0,
          }),
        ]);
        summary.added += 1;
      }
      if (has('stock') && Number.isFinite(Number(r.stock))) {
        applyMovements([{ barcode, setTo: Number(r.stock), reason: 'Import' }], 'Admin');
      }
    });
    return summary;
=======
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
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
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
<<<<<<< HEAD
=======
        refreshProducts: refreshAll,
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
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
