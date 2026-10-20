import { Router } from '../asyncRouter.js';
import { pool, httpError } from '../db.js';

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

// body: { storeName, printRates: { bw, color }, defaultCritical }
router.put('/', async (req, res) => {
  const { storeName, printRates, defaultCritical } = req.body;
  const bw = Number(printRates?.bw);
  const color = Number(printRates?.color);
  if (!(bw >= 0) || !(color >= 0)) throw httpError(400, 'Enter a valid price for both rates.');
  if (!(Number(defaultCritical) >= 0)) throw httpError(400, 'Enter a whole number, 0 or more.');

  await pool.query(
    'UPDATE settings SET store_name = ?, bw_rate = ?, color_rate = ?, default_critical = ? WHERE id = 1',
    [storeName || 'JASRAIN', bw, color, Math.floor(Number(defaultCritical))]
  );
  res.json({ ok: true });
});

export default router;
