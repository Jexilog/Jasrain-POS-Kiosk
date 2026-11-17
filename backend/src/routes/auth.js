import { Router } from '../asyncRouter.js';
import { pool, httpError } from '../db.js';
import { verifyPassword, signToken, requireAuth } from '../auth.js';

const router = Router();

// a few wrong passwords from one address in a row means a short wait
const failures = new Map();
const MAX_TRIES = 5;
const WAIT_MS = 60 * 1000;

router.post('/login', async (req, res) => {
  const ip = req.ip;
  const f = failures.get(ip);
  if (f && f.count >= MAX_TRIES && Date.now() < f.until) {
    throw httpError(429, 'Too many tries. Wait a minute and try again.');
  }

  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM admin_user WHERE username = ?', [String(username || '')]);
  const ok = rows.length && verifyPassword(String(password || ''), rows[0].password_hash);

  if (!ok) {
    failures.set(ip, { count: (f && Date.now() < f.until ? f.count : 0) + 1, until: Date.now() + WAIT_MS });
    throw httpError(401, 'Wrong username or password.');
  }

  failures.delete(ip);
  const user = { id: rows[0].id, username: rows[0].username, role: rows[0].role };
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

export default router;
