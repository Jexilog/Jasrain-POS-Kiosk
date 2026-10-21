import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { requireAuth } from '../auth.js';
import { applyMovements, nextNumber } from '../stock.js';

const router = Router();
const money = (n) => Math.round(n * 100) / 100;

const toOrder = (r, items) => ({
  id: r.order_number,
  orderNumber: r.order_number,
  total: r.total,
  payment: r.payment,
  status: r.status,
  createdAt: r.created_at,
  paidAt: r.paid_at,
  ...(r.cash_received != null ? { cashReceived: r.cash_received, change: r.change_amount, changeGiven: Boolean(r.change_given) } : {}),
  demo: Boolean(r.is_demo),
  items: items.map(({ order_number, ...i }) => i),
});

async function loadOrders(where = '', params = []) {
  const [orders] = await pool.query(`SELECT * FROM store_order ${where} ORDER BY created_at, order_number`, params);
  if (!orders.length) return [];
  const [items] = await pool.query(
    'SELECT order_number, barcode, name, price, quantity, cost, category FROM order_item WHERE order_number IN (?)',
    [orders.map((o) => o.order_number)]
  );
  return orders.map((o) => toOrder(o, items.filter((i) => i.order_number === o.order_number)));
}

router.get('/', requireAuth, async (req, res) => {
  res.json(await loadOrders());
});

// The kiosk calls this. Prices and the total come from the database, not from the browser.
// body: { items: [{ barcode, quantity }], payment, cash: { received } | null }
router.post('/', async (req, res) => {
  const { items, payment, cash } = req.body;
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'The cart is empty.');

  const orderNumber = await transaction(async (conn) => {
    const number = await nextNumber(conn, 'store_order', 'order_number', 'A');

    // work out the lines and the total from the product table
    const lines = [];
    for (const i of items) {
      const quantity = Math.floor(Number(i.quantity));
      if (!(quantity > 0)) throw httpError(400, 'Quantity must be 1 or more.');
      const [rows] = await conn.query('SELECT * FROM product WHERE barcode = ? FOR UPDATE', [i.barcode]);
      if (!rows.length || !rows[0].active) throw httpError(400, `Item ${i.barcode} is not available.`);
      const p = rows[0];
      if (p.stock < quantity) throw httpError(409, `Only ${p.stock} of ${p.name} left.`);
      lines.push({ product: p, quantity });
    }
    const total = money(lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0));

    // paid in the cash machine = Paid, otherwise it waits for staff
    let received = null;
    let change = null;
    if (cash) {
      received = Number(cash.received);
      if (!(received >= total)) throw httpError(400, 'The cash received is less than the total.');
      change = money(received - total);
    }

    await conn.query(
      `INSERT INTO store_order (order_number, total, payment, status, paid_at, cash_received, change_amount, change_given)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [number, total, payment || 'Cash', cash ? 'Paid' : 'Unpaid', cash ? new Date() : null, received, change, cash ? change === 0 : false]
    );

    for (const { product: p, quantity } of lines) {
      await conn.query(
        'INSERT INTO order_item (order_number, barcode, name, price, quantity, cost, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [number, p.barcode, p.name, p.price, quantity, p.cost, p.category]
      );
    }

    // placing an order takes the items out of stock right away
    await applyMovements(
      conn,
      lines.map((l) => ({ barcode: l.product.barcode, delta: -l.quantity, reason: 'Sale' })),
      'Kiosk',
      number
    );
    return number;
  });

  const [order] = await loadOrders('WHERE order_number = ?', [orderNumber]);
  res.status(201).json(order);
});

router.post('/:orderNumber/pay', requireAuth, async (req, res) => {
  await pool.query("UPDATE store_order SET status = 'Paid', paid_at = NOW() WHERE order_number = ?", [req.params.orderNumber]);
  res.json({ ok: true });
});

// cancelling an unpaid order puts the items back in stock
router.post('/:orderNumber/cancel', requireAuth, async (req, res) => {
  const number = req.params.orderNumber;
  await transaction(async (conn) => {
    const [rows] = await conn.query('SELECT status, is_demo FROM store_order WHERE order_number = ? FOR UPDATE', [number]);
    if (!rows.length) throw httpError(404, 'Order not found.');

    if (rows[0].status === 'Unpaid' && !rows[0].is_demo) {
      const [items] = await conn.query('SELECT barcode, quantity FROM order_item WHERE order_number = ?', [number]);
      await applyMovements(
        conn,
        items.map((i) => ({ barcode: i.barcode, delta: i.quantity, reason: 'Order cancelled' })),
        'Staff',
        number
      );
    }
    await conn.query("UPDATE store_order SET status = 'Cancelled' WHERE order_number = ?", [number]);
  });
  res.json({ ok: true });
});

router.post('/:orderNumber/give-change', requireAuth, async (req, res) => {
  await pool.query('UPDATE store_order SET change_given = TRUE WHERE order_number = ?', [req.params.orderNumber]);
  res.json({ ok: true });
});

router.delete('/:orderNumber', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM store_order WHERE order_number = ?', [req.params.orderNumber]);
  res.json({ ok: true });
});

export default router;
