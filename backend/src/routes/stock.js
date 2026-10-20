import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { applyMovements } from '../stock.js';

const router = Router();

// body: { changes: [{ barcode, delta | setTo, reason, note }], by }
router.post('/adjust', async (req, res) => {
  const { changes, by } = req.body;
  if (!Array.isArray(changes) || !changes.length) throw httpError(400, 'No changes given.');
  const entries = await transaction((conn) => applyMovements(conn, changes, by || 'Admin'));
  res.json(entries);
});

router.get('/log', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.at, m.barcode, p.name, m.delta, m.stock_after AS stockAfter,
            m.reason, COALESCE(m.order_number, m.note, '') AS note, m.done_by AS \`by\`
     FROM stock_movement m JOIN product p ON p.barcode = m.barcode
     ORDER BY m.at DESC, m.id DESC LIMIT 2000`
  );
  res.json(rows);
});

export default router;
