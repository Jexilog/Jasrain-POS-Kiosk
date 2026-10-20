import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { applyMovements, nextNumber } from '../stock.js';

const router = Router();

const toOrder = (r, items) => ({
  orderNumber: r.order_number,
  total: r.total,
  payment: r.payment,
  status: r.status,
  createdAt: r.created_at,
  paidAt: r.paid_at,
  cashReceived: r.cash_received,
  change: r.change_amount,
  changeGiven: Boolean(r.change_given),
  items,
});

async function loadOrders(where = '', params = []) {
  const [orders] = await pool.query(`SELECT * FROM store_order ${where} ORDER BY created_at`, params);
  if (!orders.length) return [];
  const [items] = await pool.query(
    'SELECT order_number, barcode, name, price, quantity, cost, category FROM order_item WHERE order_number IN (?)',
    [orders.map((o) => o.order_number)]
  );
  return orders.map((o) => toOrder(o, items.filter((i) => i.order_number === o.order_number)));
}

router.get('/', async (req, res) => {
  res.json(await loadOrders());
});

// body: { items: [{ barcode, quantity }], total, payment, cash: { received, change } | null }
router.post('/', async (req, res) => {
  const { items, total, payment, cash } = req.body;
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'The cart is empty.');

  const orderNumber = await transaction(async (conn) => {
    const number = await nextNumber(conn, 'store_order', 'order_number', 'A');
    const paid = Boolean(cash);

    await conn.query(
      `INSERT INTO store_order (order_number, total, payment, status, paid_at, cash_received, change_amount, change_given)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [number, total, payment || 'Cash', paid ? 'Paid' : 'Unpaid', paid ? new Date() : null,
       paid ? cash.received : null, paid ? cash.change : null, paid ? cash.change === 0 : false]
    );

    for (const i of items) {
      const [rows] = await conn.query('SELECT name, price, cost, category, stock FROM product WHERE barcode = ? FOR UPDATE', [i.barcode]);
      if (!rows.length) throw httpError(400, `Item ${i.barcode} was not found.`);
      const p = rows[0];
      if (p.stock < i.quantity) throw httpError(409, `Only ${p.stock} of ${p.name} left.`);

      await conn.query(
        'INSERT INTO order_item (order_number, barcode, name, price, quantity, cost, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [number, i.barcode, p.name, p.price, i.quantity, p.cost, p.category]
      );
    }

    // placing an order takes the items out of stock right away
    await applyMovements(
      conn,
      items.map((i) => ({ barcode: i.barcode, delta: -i.quantity, reason: 'Sale' })),
      'Kiosk',
      number
    );
    return number;
  });

  const [order] = await loadOrders('WHERE order_number = ?', [orderNumber]);
  res.status(201).json(order);
});

router.post('/:orderNumber/pay', async (req, res) => {
  await pool.query("UPDATE store_order SET status = 'Paid', paid_at = NOW() WHERE order_number = ?", [req.params.orderNumber]);
  res.json({ ok: true });
});

// cancelling an unpaid order puts the items back in stock
router.post('/:orderNumber/cancel', async (req, res) => {
  const number = req.params.orderNumber;
  await transaction(async (conn) => {
    const [rows] = await conn.query('SELECT status FROM store_order WHERE order_number = ? FOR UPDATE', [number]);
    if (!rows.length) throw httpError(404, 'Order not found.');

    if (rows[0].status === 'Unpaid') {
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

router.post('/:orderNumber/give-change', async (req, res) => {
  await pool.query('UPDATE store_order SET change_given = TRUE WHERE order_number = ?', [req.params.orderNumber]);
  res.json({ ok: true });
});

router.delete('/:orderNumber', async (req, res) => {
  await pool.query('DELETE FROM store_order WHERE order_number = ?', [req.params.orderNumber]);
  res.json({ ok: true });
});

export default router;
