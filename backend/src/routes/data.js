import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// body: { orders: [...], jobs: [...] } made by the frontend (utils/demoData.js)
router.post('/demo', async (req, res) => {
  const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
  const jobs = Array.isArray(req.body.jobs) ? req.body.jobs : [];

  await transaction(async (conn) => {
    const [known] = await conn.query('SELECT barcode FROM product');
    const barcodes = new Set(known.map((p) => p.barcode));

    for (const o of orders) {
      const items = (o.items || []).filter((i) => barcodes.has(i.barcode));
      if (!items.length) continue;
      await conn.query(
        `INSERT INTO store_order (order_number, total, payment, status, created_at, paid_at, is_demo)
         VALUES (?, ?, ?, 'Paid', ?, ?, TRUE)`,
        [o.orderNumber, o.total, o.payment || 'Cash', new Date(o.createdAt), new Date(o.paidAt)]
      );
      for (const i of items) {
        await conn.query(
          'INSERT INTO order_item (order_number, barcode, name, price, quantity, cost, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [o.orderNumber, i.barcode, i.name, i.price, i.quantity, i.cost ?? null, i.category ?? null]
        );
      }
    }

    for (const j of jobs) {
      await conn.query(
        `INSERT INTO print_job (queue_number, file_name, file_size, file_type, pages, copies, color, paper_size,
                                total, payment, status, created_at, completed_at, is_demo)
         VALUES (?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?, 'Completed', ?, ?, TRUE)`,
        [j.queueNumber, j.fileName, j.fileSize ?? null, j.pages, j.copies, j.color, j.paperSize, j.total,
         j.payment || 'Cash', new Date(j.createdAt), new Date(j.createdAt)]
      );
    }
  });
  res.json({ ok: true });
});

router.delete('/demo', async (req, res) => {
  await transaction(async (conn) => {
    await conn.query('DELETE FROM store_order WHERE is_demo = TRUE');
    await conn.query('DELETE FROM print_job WHERE is_demo = TRUE');
  });
  res.json({ ok: true });
});

// everything except uploaded print files and user accounts
router.get('/backup', async (req, res) => {
  const tables = ['settings', 'product', 'store_order', 'order_item', 'stock_movement', 'print_job'];
  const data = {};
  for (const t of tables) {
    const [rows] = await pool.query(`SELECT * FROM ${t}`);
    data[t] = rows;
  }
  res.json({ app: 'jasrain-kiosk', exportedAt: new Date().toISOString(), data });
});

// body: { confirm: 'RESET' }. Deletes products, orders, stock log and print jobs.
router.post('/reset', async (req, res) => {
  if (req.body.confirm !== 'RESET') throw httpError(400, 'Type RESET to confirm.');
  await transaction(async (conn) => {
    for (const t of ['print_file', 'print_job', 'stock_movement', 'order_item', 'store_order', 'product']) {
      await conn.query(`DELETE FROM ${t}`);
    }
    await conn.query(
      "UPDATE settings SET store_name = 'JASRAIN', bw_rate = 3, color_rate = 10, default_critical = 5 WHERE id = 1"
    );
  });
  res.json({ ok: true });
});

export default router;
