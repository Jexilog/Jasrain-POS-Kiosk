// Files that reach the kiosk without a USB drive:
//   phone      the customer scans a QR code and uploads from their phone
//   messenger  the customer messages the file to the shop page, staff attach it here
//   email      same, but by email
// Files are only kept for a short time and are deleted after the customer pays.
import crypto from 'node:crypto';
import express from 'express';
import { Router } from '../asyncRouter.js';
import { pool, httpError } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'];
const TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
const PHONE_WAIT_MINUTES = 10; // how long a QR code works
const KEEP_HOURS = 24; // how long Messenger / email files can be found
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0 O 1 I, easy to type

const rawBody = express.raw({ type: '*/*', limit: '25mb' });

const makeCode = () => Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
const makeKey = () => crypto.randomBytes(12).toString('hex');
const extOf = (name) => String(name).split('.').pop().toLowerCase();

// "  Juan   DELA cruz " -> "juan dela cruz", so small typing differences still match
const clean = (text) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 160);

// the file name travels in a header, URL encoded
function nameFrom(req) {
  let name = '';
  try {
    name = decodeURIComponent(String(req.headers['x-file-name'] || ''));
  } catch (e) {
    name = '';
  }
  name = name.replace(/[\\/]/g, '_').slice(0, 255);
  if (!name) throw httpError(400, 'File name is missing.');
  if (!ALLOWED.includes(extOf(name))) throw httpError(400, 'That file type is not supported. Use PDF, Word, Excel, PowerPoint, JPG or PNG.');
  return name;
}

function bodyFrom(req) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw httpError(400, 'No file received.');
  return req.body;
}

async function purge() {
  await pool.query(
    `DELETE FROM incoming_file
      WHERE created_at < NOW() - INTERVAL ? HOUR
         OR (source = 'phone' AND created_at < NOW() - INTERVAL 1 HOUR)
         OR (source = 'phone' AND file IS NULL AND created_at < NOW() - INTERVAL ? MINUTE)`,
    [KEEP_HOURS, PHONE_WAIT_MINUTES]
  );
}

const sendFile = (res, row) => {
  res.set('Content-Type', row.file_type || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`);
  res.send(row.file);
};

/* phone: the kiosk makes a code, the phone uploads to it */

router.post('/sessions', async (req, res) => {
  await purge();
  const [[{ open }]] = await pool.query("SELECT COUNT(*) AS open FROM incoming_file WHERE source = 'phone' AND file IS NULL");
  if (open >= 40) throw httpError(429, 'Too many codes are open. Please try again in a few minutes.');
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode();
    try {
      await pool.query("INSERT INTO incoming_file (ref, source) VALUES (?, 'phone')", [code]);
      return res.status(201).json({ code, minutes: PHONE_WAIT_MINUTES });
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  throw httpError(500, 'Could not make a code.');
});

// used by the kiosk (waiting for the file) and by the phone page (is this code still good?)
router.get('/sessions/:code', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT file_name, file_type, file_size, (file IS NOT NULL) AS has_file,
            TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age
       FROM incoming_file WHERE ref = ? AND source = 'phone'`,
    [String(req.params.code).toUpperCase()]
  );
  const r = rows[0];
  if (!r || (!r.has_file && r.age >= PHONE_WAIT_MINUTES)) return res.json({ status: 'expired' });
  if (!r.has_file) return res.json({ status: 'waiting' });
  res.json({ status: 'ready', fileName: r.file_name, fileType: r.file_type, fileSize: r.file_size });
});

// the phone sends the file as raw bytes
router.put('/sessions/:code/file', rawBody, async (req, res) => {
  const name = nameFrom(req);
  const data = bodyFrom(req);
  const type = TYPES[extOf(name)];
  const [result] = await pool.query(
    `UPDATE incoming_file SET file_name = ?, file_type = ?, file_size = ?, file = ?
      WHERE ref = ? AND source = 'phone' AND file IS NULL
        AND created_at > NOW() - INTERVAL ? MINUTE`,
    [name, type, data.length, data, String(req.params.code).toUpperCase(), PHONE_WAIT_MINUTES]
  );
  if (!result.affectedRows) throw httpError(410, 'This code has expired. Please scan the new code on the kiosk.');
  res.json({ ok: true });
});

router.get('/sessions/:code/file', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT file, file_type, file_name FROM incoming_file WHERE ref = ? AND source = 'phone' AND file IS NOT NULL",
    [String(req.params.code).toUpperCase()]
  );
  if (!rows.length) throw httpError(404, 'File not found.');
  sendFile(res, rows[0]);
});

/* Messenger and email: staff attach the file, the kiosk finds it by name or email */

// slow down guessing of names (30 searches per minute for the whole kiosk is plenty)
const recent = [];
function rateLimitFind() {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  if (recent.length >= 30) throw httpError(429, 'Please wait a moment and try again.');
  recent.push(now);
}

router.get('/find', async (req, res) => {
  rateLimitFind();
  const source = req.query.source === 'email' ? 'email' : 'messenger';
  const who = clean(req.query.who);
  if (who.length < 3) throw httpError(400, 'Type your full name or email.');
  await purge();
  const [rows] = await pool.query(
    `SELECT ref, file_name, file_type, file_size, created_at
       FROM incoming_file
      WHERE source = ? AND owner = ? AND file IS NOT NULL
      ORDER BY created_at DESC LIMIT 10`,
    [source, who]
  );
  res.json(rows.map((r) => ({ ref: r.ref, fileName: r.file_name, fileType: r.file_type, fileSize: r.file_size, createdAt: r.created_at })));
});

router.get('/files/:ref/file', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT file, file_type, file_name FROM incoming_file WHERE ref = ? AND source <> 'phone' AND file IS NOT NULL",
    [req.params.ref]
  );
  if (!rows.length) throw httpError(404, 'File not found.');
  sendFile(res, rows[0]);
});

// the kiosk calls this after the customer paid, so the file does not stay on the server
router.delete('/used/:ref', async (req, res) => {
  await pool.query('DELETE FROM incoming_file WHERE ref = ?', [String(req.params.ref).slice(0, 24)]);
  res.json({ ok: true });
});

/* staff */

router.get('/files', requireAuth, async (req, res) => {
  await purge();
  const [rows] = await pool.query(
    `SELECT id, source, owner, file_name, file_size, created_at
       FROM incoming_file WHERE source <> 'phone' AND file IS NOT NULL ORDER BY created_at DESC`
  );
  res.json(rows.map((r) => ({ id: r.id, source: r.source, owner: r.owner, fileName: r.file_name, fileSize: r.file_size, createdAt: r.created_at })));
});

// headers: X-Source (messenger | email), X-Owner (Messenger name or email), X-File-Name
router.put('/files', requireAuth, rawBody, async (req, res) => {
  const source = req.headers['x-source'] === 'email' ? 'email' : 'messenger';
  let owner = '';
  try {
    owner = clean(decodeURIComponent(String(req.headers['x-owner'] || '')));
  } catch (e) {
    owner = '';
  }
  if (owner.length < 3) throw httpError(400, 'Type the Messenger name or email of the customer.');
  if (source === 'email' && !owner.includes('@')) throw httpError(400, 'That does not look like an email address.');
  const name = nameFrom(req);
  const data = bodyFrom(req);
  await pool.query(
    'INSERT INTO incoming_file (ref, source, owner, file_name, file_type, file_size, file) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [makeKey(), source, owner, name, TYPES[extOf(name)], data.length, data]
  );
  res.status(201).json({ ok: true });
});

router.delete('/files/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM incoming_file WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
