import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { requireAuth } from '../auth.js';
import { applyMovements } from '../stock.js';

const router = Router();

const toProduct = (r, withCost) => ({
  barcode: r.barcode,
  name: r.name,
  price: r.price,
  ...(withCost ? { cost: r.cost } : {}),
  category: r.category,
  image: r.image || '',
  stock: r.stock,
  critical: r.critical,
  active: Boolean(r.active),
  createdAt: r.created_at,
});

const whole = (v) => Math.max(0, Math.floor(Number(v) || 0));

// customers get active products without the cost, staff and admin get everything
router.get('/', async (req, res) => {
  const signedIn = Boolean(req.user);
  const [rows] = await pool.query(`SELECT * FROM product ${signedIn ? '' : 'WHERE active = TRUE'} ORDER BY name`);
  res.json(rows.map((r) => toProduct(r, signedIn)));
});

router.post('/', requireAuth, async (req, res) => {
  const p = req.body;
  if (!p.name) throw httpError(400, 'Please enter a product name.');
  if (!p.barcode) throw httpError(400, 'Please enter a barcode (or tap Generate).');
  if (!(Number(p.price) > 0)) throw httpError(400, 'Price must be more than 0.');
  if (Number(p.cost) < 0) throw httpError(400, 'Cost cannot be negative.');

  await transaction(async (conn) => {
    const [clash] = await conn.query('SELECT name FROM product WHERE barcode = ?', [p.barcode]);
    if (clash.length) throw httpError(409, `That barcode is already used by "${clash[0].name}".`);

    await conn.query(
      'INSERT INTO product (barcode, name, price, cost, category, image, stock, critical, active) VALUES (?, ?, ?, ?, ?, ?, 0, ?, TRUE)',
      [p.barcode, p.name, p.price, p.cost || 0, p.category || 'Other', p.image || null, whole(p.critical)]
    );
    const initial = whole(p.stock);
    if (initial > 0) {
      await applyMovements(conn, [{ barcode: p.barcode, setTo: initial, reason: 'Initial stock' }], req.user.username);
    }
  });
  res.status(201).json({ ok: true });
});

// stock and barcode are not changed here (use /api/stock/adjust for stock)
router.put('/:barcode', requireAuth, async (req, res) => {
  const p = req.body;
  if (!p.name) throw httpError(400, 'Please enter a product name.');
  if (!(Number(p.price) > 0)) throw httpError(400, 'Price must be more than 0.');
  if (Number(p.cost) < 0) throw httpError(400, 'Cost cannot be negative.');
  const [result] = await pool.query(
    'UPDATE product SET name = ?, price = ?, cost = ?, category = ?, image = ?, critical = ? WHERE barcode = ?',
    [p.name, p.price, p.cost || 0, p.category || 'Other', p.image || null, whole(p.critical), req.params.barcode]
  );
  if (!result.affectedRows) throw httpError(404, 'Product not found.');
  res.json({ ok: true });
});

router.patch('/:barcode/active', requireAuth, async (req, res) => {
  await pool.query('UPDATE product SET active = ? WHERE barcode = ?', [Boolean(req.body.active), req.params.barcode]);
  res.json({ ok: true });
});

router.delete('/:barcode', requireAuth, async (req, res) => {
  const [sold] = await pool.query('SELECT 1 FROM order_item WHERE barcode = ? LIMIT 1', [req.params.barcode]);
  if (sold.length) throw httpError(409, 'This product has sales. Hide it instead of deleting it.');
  await transaction(async (conn) => {
    await conn.query('DELETE FROM stock_movement WHERE barcode = ?', [req.params.barcode]);
    await conn.query('DELETE FROM product WHERE barcode = ?', [req.params.barcode]);
  });
  res.json({ ok: true });
});

// body: { rows: [{ barcode, name, price, cost, category, critical, stock }] } (from a CSV file)
router.post('/import', requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const summary = { added: 0, updated: 0, errors: [] };

  await transaction(async (conn) => {
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const line = i + 2;
      const barcode = String(r.barcode ?? '').trim();
      const name = String(r.name ?? '').trim();
      const price = Number(r.price);
      if (!barcode || !name || !(price > 0)) {
        summary.errors.push(`Row ${line}: needs a barcode, a name and a price above 0`);
        continue;
      }
      const has = (k) => r[k] !== undefined && r[k] !== '';
      const [found] = await conn.query('SELECT * FROM product WHERE barcode = ?', [barcode]);

      if (found.length) {
        const e = found[0];
        await conn.query(
          'UPDATE product SET name = ?, price = ?, cost = ?, category = ?, critical = ? WHERE barcode = ?',
          [name, price, has('cost') ? Number(r.cost) || 0 : e.cost, has('category') ? String(r.category).trim() : e.category,
           has('critical') ? whole(r.critical) : e.critical, barcode]
        );
        summary.updated += 1;
      } else {
        await conn.query(
          'INSERT INTO product (barcode, name, price, cost, category, stock, critical, active) VALUES (?, ?, ?, ?, ?, 0, ?, TRUE)',
          [barcode, name, price, Number(r.cost) || 0, has('category') ? String(r.category).trim() : 'Other', whole(r.critical)]
        );
        summary.added += 1;
      }
      if (has('stock') && Number.isFinite(Number(r.stock))) {
        await applyMovements(conn, [{ barcode, setTo: Number(r.stock), reason: 'Import' }], req.user.username);
      }
    }
  });
  res.json(summary);
});

export default router;
