// Sample sales for the dashboard.
// Demo records have demo: true so they can be removed without touching real data.
import { products as seedProducts } from './products';

const ORDERS_KEY = 'jasrain_orders';
const QUEUE_KEY = 'jasrain_print_queue';
const PRODUCTS_KEY = 'jasrain_products';
const SETTINGS_KEY = 'jasrain_settings';

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

// seeded random so the demo data is the same every time
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// some items sell a lot, some barely at all
const POPULARITY = [1.0, 0.9, 0.6, 1.4, 0.5, 0.12, 0.45, 0.8, 1.1, 0.04];
const HOUR_WEIGHT = {
  7: 4, 8: 6, 9: 3, 10: 2, 11: 4, 12: 7, 13: 6, 14: 3, 15: 3, 16: 5, 17: 8, 18: 9, 19: 7, 20: 4, 21: 2,
};

function pick(rand, entries) {
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = rand() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.v;
  }
  return entries[entries.length - 1].v;
}

export function generateDemo(products, rates, now = new Date(), days = 30, seed = 20260518) {
  const rand = mulberry32(seed);
  const list = products.filter((p) => p.active !== false);
  const weighted = list.map((p, i) => ({ v: p, w: POPULARITY[i] ?? 0.5 }));
  const hours = Object.entries(HOUR_WEIGHT).map(([h, w]) => ({ v: Number(h), w }));
  const orders = [];
  const jobs = [];
  let oN = 0;
  let jN = 0;

  for (let back = days - 1; back >= 0; back -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    day.setHours(0, 0, 0, 0);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const orderCount = Math.round((weekend ? 15 : 10) * (0.7 + rand() * 0.6));
    const jobCount = Math.round((weekend ? 2 : 4) * (0.6 + rand() * 0.8));

    for (let k = 0; k < orderCount; k += 1) {
      const when = new Date(day);
      when.setHours(pick(rand, hours), Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (when > now) continue;

      const lines = 1 + Math.floor(rand() * 3);
      const items = [];
      for (let l = 0; l < lines; l += 1) {
        const p = pick(rand, weighted);
        if (items.some((i) => i.barcode === p.barcode)) continue;
        const quantity = rand() < 0.75 ? 1 : 2 + Math.floor(rand() * 2);
        items.push({
          barcode: p.barcode, name: p.name, price: p.price, cost: p.cost, category: p.category, quantity,
        });
      }
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      oN += 1;
      orders.push({
        id: -oN,
        orderNumber: `D${String(oN).padStart(3, '0')}`,
        items,
        total,
        payment: 'Cash at counter',
        status: 'Paid',
        createdAt: when.toISOString(),
        paidAt: new Date(when.getTime() + (2 + Math.floor(rand() * 5)) * 60000).toISOString(),
        demo: true,
      });
    }

    for (let k = 0; k < jobCount; k += 1) {
      const when = new Date(day);
      when.setHours(pick(rand, hours), Math.floor(rand() * 60));
      if (when > now) continue;
      const pages = 1 + Math.floor(rand() * rand() * 25);
      const copies = rand() < 0.8 ? 1 : 2 + Math.floor(rand() * 2);
      const color = rand() < 0.2 ? 'color' : 'bw';
      const paperSize = pick(rand, [{ v: 'Short', w: 6 }, { v: 'A4', w: 3 }, { v: 'Long', w: 1 }]);
      jN += 1;
      jobs.push({
        id: -100000 - jN,
        queueNumber: `D${String(jN).padStart(3, '0')}`,
        fileName: `Sample document ${jN}.pdf`,
        fileSize: 120000,
        hasFile: false,
        pages,
        copies,
        color,
        paperSize,
        total: pages * copies * (color === 'bw' ? rates.bw : rates.color),
        payment: 'Pay at counter',
        status: 'Completed',
        createdAt: when.toISOString(),
        demo: true,
      });
    }
  }
  return { orders, jobs };
}

export function hasDemoData() {
  const o = readJSON(ORDERS_KEY, { orders: [] });
  const q = readJSON(QUEUE_KEY, { queue: [] });
  return (o.orders || []).some((x) => x.demo) || (q.queue || []).some((x) => x.demo);
}

export function applyDemoData() {
  const products = readJSON(PRODUCTS_KEY, null) || seedProducts;
  const settings = readJSON(SETTINGS_KEY, {});
  const rates = (settings && settings.printRates) || { bw: 3, color: 10 };
  const { orders, jobs } = generateDemo(products, rates);

  const o = readJSON(ORDERS_KEY, { orders: [], counter: 0 });
  const q = readJSON(QUEUE_KEY, { queue: [], counter: 0 });
  const realOrders = (o.orders || []).filter((x) => !x.demo);
  const realJobs = (q.queue || []).filter((x) => !x.demo);

  localStorage.setItem(ORDERS_KEY, JSON.stringify({ ...o, orders: [...orders, ...realOrders] }));
  localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...q, queue: [...jobs, ...realJobs] }));
  window.location.reload();
}

export function clearDemoData() {
  const o = readJSON(ORDERS_KEY, { orders: [], counter: 0 });
  const q = readJSON(QUEUE_KEY, { queue: [], counter: 0 });
  localStorage.setItem(ORDERS_KEY, JSON.stringify({ ...o, orders: (o.orders || []).filter((x) => !x.demo) }));
  localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...q, queue: (q.queue || []).filter((x) => !x.demo) }));
  window.location.reload();
}
