import express from 'express';
import { Router } from '../asyncRouter.js';
import { pool, httpError } from '../db.js';
import * as auth from '../auth.js';

// Product pictures, kept in the database (table product_image).
// The kiosk loads them like any picture; only the admin can add or remove one.
const router = Router();
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// only the admin may change pictures (older backends only have requireAuth)
const requireAdmin = auth.requireAdmin || auth.requireAuth;

router.get('/:barcode/image', async (req, res) => {
  const [rows] = await pool.query('SELECT mime, data FROM product_image WHERE barcode = ?', [req.params.barcode]);
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].mime);
  // the address changes with every new picture (?v=...), so browsers can keep it for a long time
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(rows[0].data);
});

router.put('/:barcode/image', requireAdmin, express.raw({ type: TYPES, limit: '1mb' }), async (req, res) => {
  const { barcode } = req.params;
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw httpError(400, 'Please send a JPEG, PNG or WebP picture (up to 1 MB).');
  const [found] = await pool.query('SELECT 1 FROM product WHERE barcode = ?', [barcode]);
  if (!found.length) throw httpError(404, 'Product not found.');

  const mime = String(req.headers['content-type']).split(';')[0];
  await pool.query(
    'INSERT INTO product_image (barcode, mime, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mime = VALUES(mime), data = VALUES(data)',
    [barcode, mime, req.body]
  );
  const image = `api:products/${encodeURIComponent(barcode)}/image?v=${Date.now()}`;
  await pool.query('UPDATE product SET image = ? WHERE barcode = ?', [image, barcode]);
  res.json({ ok: true, image });
});

router.delete('/:barcode/image', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM product_image WHERE barcode = ?', [req.params.barcode]);
  await pool.query("UPDATE product SET image = NULL WHERE barcode = ? AND image LIKE 'api:%'", [req.params.barcode]);
  res.json({ ok: true });
});

export default router;
