import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { requireAuth } from '../auth.js';
import { applyMovements } from '../stock.js';

const router = Router();
router.use(requireAuth);

// body: { changes: [{ barcode, delta | setTo, reason, note }] }
router.post('/adjust', async (req, res) => {
  const { changes } = req.body;
  if (!Array.isArray(changes) || !changes.length) throw httpError(400, 'No changes given.');

  const entries = await transaction(async (conn) => {
    const done = await applyMovements(conn, changes, req.user.username);
    if (!done.length) return done;
    const [names] = await conn.query('SELECT barcode, name FROM product WHERE barcode IN (?)', [done.map((d) => d.barcode)]);
    return done.map((d) => ({ ...d, name: names.find((n) => n.barcode === d.barcode)?.name }));
  });
  res.json(entries);
});

router.get('/log', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT m.id, m.at, m.barcode, p.name, m.delta, m.stock_after AS stockAfter,
              m.reason, COALESCE(m.order_number, m.note, '') AS note, m.done_by AS \`by\`
       FROM stock_movement m JOIN product p ON p.barcode = m.barcode
       ORDER BY m.at DESC, m.id DESC LIMIT 3000
     ) latest ORDER BY at, id`
  );
  res.json(rows);
});

export default router;
