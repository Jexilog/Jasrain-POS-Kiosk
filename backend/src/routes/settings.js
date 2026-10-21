import { Router } from '../asyncRouter.js';
import { pool, httpError } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const toSettings = (r) => ({
  storeName: r.store_name,
  printRates: { bw: r.bw_rate, color: r.color_rate },
  defaultCritical: r.default_critical,
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
  res.json(toSettings(rows[0]));
});

// body: { storeName?, printRates?: { bw, color }, defaultCritical? } (only what changed)
router.put('/', requireAuth, async (req, res) => {
  const [[cur]] = await pool.query('SELECT * FROM settings WHERE id = 1');
  const { storeName, printRates, defaultCritical } = req.body;

  const bw = printRates?.bw != null ? Number(printRates.bw) : cur.bw_rate;
  const color = printRates?.color != null ? Number(printRates.color) : cur.color_rate;
  const crit = defaultCritical != null ? Number(defaultCritical) : cur.default_critical;
  if (!(bw >= 0) || !(color >= 0)) throw httpError(400, 'Enter a valid price for both rates.');
  if (!(crit >= 0)) throw httpError(400, 'Enter a whole number, 0 or more.');

  await pool.query(
    'UPDATE settings SET store_name = ?, bw_rate = ?, color_rate = ?, default_critical = ? WHERE id = 1',
    [storeName || cur.store_name, bw, color, Math.floor(crit)]
  );
  res.json({ ok: true });
});

export default router;
