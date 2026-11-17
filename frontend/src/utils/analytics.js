// Turns orders and print jobs into numbers for the admin dashboard.
// Revenue = paid store orders + completed print jobs.

export const DAY = 86400000;

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// time ranges
export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

// the chosen period and the one right before it
export function rangeFor(key, now = new Date()) {
  if (key === 'today') {
    const from = startOfDay(now);
    return { key, from, to: now, prevFrom: addDays(from, -1), prevTo: from, days: 1, compareLabel: 'vs yesterday' };
  }
  const days = key === '90d' ? 90 : key === '30d' ? 30 : 7;
  const from = startOfDay(addDays(now, -(days - 1)));
  return {
    key,
    from,
    to: now,
    prevFrom: addDays(from, -days),
    prevTo: from,
    days,
    compareLabel: `vs previous ${days} days`,
  };
}

// selecting the right records
const orderTime = (o) => new Date(o.paidAt || o.createdAt);
const jobTime = (j) => new Date(j.completedAt || j.createdAt);

export const paidOrders = (orders) => orders.filter((o) => o.status === 'Paid');
export const doneJobs = (jobs) => jobs.filter((j) => j.status === 'Completed');

export const ordersIn = (orders, from, to) =>
  paidOrders(orders).filter((o) => {
    const t = orderTime(o);
    return t >= from && t < to;
  });

export const jobsIn = (jobs, from, to) =>
  doneJobs(jobs).filter((j) => {
    const t = jobTime(j);
    return t >= from && t < to;
  });

const itemCost = (item, costLookup) => {
  if (typeof item.cost === 'number') return item.cost;
  if (costLookup && typeof costLookup[item.barcode] === 'number') return costLookup[item.barcode];
  return item.price; // unknown cost: assume no profit instead of inventing one
};

// headline numbers
export function kpis(orders, jobs, costLookup) {
  let storeRevenue = 0;
  let units = 0;
  let cost = 0;
  orders.forEach((o) => {
    storeRevenue += Number(o.total);
    o.items.forEach((i) => {
      units += i.quantity;
      cost += itemCost(i, costLookup) * i.quantity;
    });
  });
  const printRevenue = jobs.reduce((s, j) => s + Number(j.total), 0);
  const sheets = jobs.reduce((s, j) => s + j.pages * j.copies, 0);
  const profit = storeRevenue - cost;
  return {
    storeRevenue,
    printRevenue,
    revenue: storeRevenue + printRevenue,
    orders: orders.length,
    avgOrder: orders.length ? storeRevenue / orders.length : 0,
    units,
    cost,
    profit,
    margin: storeRevenue > 0 ? (profit / storeRevenue) * 100 : null,
    printJobs: jobs.length,
    sheets,
  };
}

// % change vs the previous period. null = nothing to compare with.
export function change(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

// day by day
export function dailySeries(orders, jobs, from, to, costLookup) {
  const days = [];
  const index = {};
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
    const row = { date: new Date(d), store: 0, print: 0, orders: 0, jobs: 0, profit: 0 };
    index[dayKey(d)] = row;
    days.push(row);
  }
  orders.forEach((o) => {
    const row = index[dayKey(orderTime(o))];
    if (!row) return;
    row.store += Number(o.total);
    row.orders += 1;
    o.items.forEach((i) => {
      row.profit += (i.price - itemCost(i, costLookup)) * i.quantity;
    });
  });
  jobs.forEach((j) => {
    const row = index[dayKey(jobTime(j))];
    if (!row) return;
    row.print += Number(j.total);
    row.jobs += 1;
  });
  return days;
}

// per product (fast / slow moving)
export const MOVE = { FAST: 'Fast', MEDIUM: 'Medium', SLOW: 'Slow', DEAD: 'No sales' };

export function productStats(orders, products, days, costLookup) {
  const map = {};
  products.forEach((p) => {
    map[p.barcode] = {
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      stock: p.stock,
      critical: p.critical,
      price: p.price,
      cost: p.cost,
      active: p.active !== false,
      units: 0,
      revenue: 0,
      profit: 0,
      lastSold: null,
    };
  });
  orders.forEach((o) => {
    o.items.forEach((i) => {
      let s = map[i.barcode];
      if (!s) {
        // product was deleted later; keep its sales in the report
        s = map[i.barcode] = {
          barcode: i.barcode, name: i.name, category: i.category || 'Other',
          stock: null, critical: null, price: i.price, cost: i.cost, active: false,
          units: 0, revenue: 0, profit: 0, lastSold: null, removed: true,
        };
      }
      s.units += i.quantity;
      s.revenue += i.price * i.quantity;
      s.profit += (i.price - itemCost(i, costLookup)) * i.quantity;
      const t = orderTime(o);
      if (!s.lastSold || t > s.lastSold) s.lastSold = t;
    });
  });

  const list = Object.values(map).filter((s) => !s.removed || s.units > 0);
  const d = Math.max(1, days);
  list.forEach((s) => {
    s.velocity = s.units / d;
    s.daysLeft = s.velocity > 0 && s.stock != null ? s.stock / s.velocity : null;
  });

  // Fast = top 25% of the items that sold, Slow = bottom 25%, rest Medium
  const sellers = list
    .filter((s) => s.units > 0)
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  const n = sellers.length;
  const cut = n >= 3 ? Math.max(1, Math.round(n * 0.25)) : 0;
  sellers.forEach((s, idx) => {
    if (cut && idx < cut) s.move = MOVE.FAST;
    else if (cut && idx >= n - cut) s.move = MOVE.SLOW;
    else s.move = MOVE.MEDIUM;
  });
  list.forEach((s) => {
    if (s.units === 0) s.move = MOVE.DEAD;
  });
  return list;
}

// breakdowns
export function byCategory(orders, catLookup) {
  const map = {};
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const c = i.category || (catLookup && catLookup[i.barcode]) || 'Other';
      map[c] = (map[c] || 0) + i.price * i.quantity;
    })
  );
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function byHour(orders, jobs) {
  const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
  orders.forEach((o) => {
    const r = rows[new Date(o.createdAt).getHours()];
    r.orders += 1;
    r.revenue += Number(o.total);
  });
  (jobs || []).forEach((j) => {
    const r = rows[new Date(j.createdAt).getHours()];
    r.orders += 1;
    r.revenue += Number(j.total);
  });
  return rows;
}

// average revenue for each weekday (Mon..Sun)
export function byWeekday(orders, jobs, from, to) {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) counts[d.getDay()] += 1;
  orders.forEach((o) => { sums[orderTime(o).getDay()] += Number(o.total); });
  (jobs || []).forEach((j) => { sums[jobTime(j).getDay()] += Number(j.total); });
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({ dow, avg: counts[dow] ? sums[dow] / counts[dow] : 0, days: counts[dow] }));
}

export function byPayment(orders) {
  const map = {};
  orders.forEach((o) => {
    map[o.payment] = (map[o.payment] || 0) + Number(o.total);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function printStats(jobs) {
  const out = { jobs: jobs.length, sheets: 0, bwSheets: 0, colorSheets: 0, revenue: 0, paper: {} };
  jobs.forEach((j) => {
    const sheets = j.pages * j.copies;
    out.sheets += sheets;
    if (j.color === 'color') out.colorSheets += sheets;
    else out.bwSheets += sheets;
    out.revenue += Number(j.total);
    out.paper[j.paperSize] = (out.paper[j.paperSize] || 0) + sheets;
  });
  out.avgJob = out.jobs ? out.revenue / out.jobs : 0;
  return out;
}

// stock status
export const STOCK = { OK: 'ok', LOW: 'low', OUT: 'out' };

export function stockStatus(p) {
  if (p.stock <= 0) return STOCK.OUT;
  if (p.stock <= p.critical) return STOCK.LOW;
  return STOCK.OK;
}

// how many to buy to cover coverDays of stock (default: 2x the critical level)
export function suggestReorder(stat, coverDays = 14) {
  if (stat.stock == null) return 0;
  const target = stat.velocity > 0 ? Math.ceil(stat.velocity * coverDays) : (stat.critical || 0) * 2;
  return Math.max(0, Math.ceil(target - stat.stock));
}
