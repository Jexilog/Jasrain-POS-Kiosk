import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { applyMovements } from '../stock.js';

const router = Router();

const toProduct = (r) => ({
  barcode: r.barcode,
  name: r.name,
  price: r.price,
  cost: r.cost,
  category: r.category,
  image: r.image || '',
  stock: r.stock,
  critical: r.critical,
  active: Boolean(r.active),
  createdAt: r.created_at,
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM product ORDER BY name');
  res.json(rows.map(toProduct));
});

router.post('/', async (req, res) => {
  const p = req.body;
  if (!p.name || !p.barcode) throw httpError(400, 'Name and barcode are required.');
  if (!(Number(p.price) > 0)) throw httpError(400, 'Price must be more than 0.');
  if (Number(p.cost) < 0) throw httpError(400, 'Cost cannot be negative.');

  await transaction(async (conn) => {
    const [clash] = await conn.query('SELECT name FROM product WHERE barcode = ?', [p.barcode]);
    if (clash.length) throw httpError(409, `That barcode is already used by "${clash[0].name}".`);

    await conn.query(
      'INSERT INTO product (barcode, name, price, cost, category, image, stock, critical, active) VALUES (?, ?, ?, ?, ?, ?, 0, ?, TRUE)',
      [p.barcode, p.name, p.price, p.cost || 0, p.category || 'Other', p.image || null, p.critical ?? 5]
    );
    const initial = Math.max(0, Math.floor(Number(p.stock) || 0));
    if (initial > 0) await applyMovements(conn, [{ barcode: p.barcode, setTo: initial, reason: 'Initial stock' }], 'Admin');
  });
  res.status(201).json({ ok: true });
});

// stock and barcode are not changed here (use /api/stock/adjust for stock)
router.put('/:barcode', async (req, res) => {
  const p = req.body;
  if (!p.name) throw httpError(400, 'Please enter a product name.');
  if (!(Number(p.price) > 0)) throw httpError(400, 'Price must be more than 0.');
  const [result] = await pool.query(
    'UPDATE product SET name = ?, price = ?, cost = ?, category = ?, image = ?, critical = ? WHERE barcode = ?',
    [p.name, p.price, p.cost || 0, p.category || 'Other', p.image || null, p.critical ?? 5, req.params.barcode]
  );
  if (!result.affectedRows) throw httpError(404, 'Product not found.');
  res.json({ ok: true });
});

router.patch('/:barcode/active', async (req, res) => {
  await pool.query('UPDATE product SET active = ? WHERE barcode = ?', [Boolean(req.body.active), req.params.barcode]);
  res.json({ ok: true });
});

router.delete('/:barcode', async (req, res) => {
  const [sold] = await pool.query('SELECT 1 FROM order_item WHERE barcode = ? LIMIT 1', [req.params.barcode]);
  if (sold.length) throw httpError(409, 'This product has sales. Hide it instead of deleting it.');
  await pool.query('DELETE FROM stock_movement WHERE barcode = ?', [req.params.barcode]);
  await pool.query('DELETE FROM product WHERE barcode = ?', [req.params.barcode]);
  res.json({ ok: true });
});

export default router;
