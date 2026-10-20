import express from 'express';
import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { nextNumber } from '../stock.js';

const router = Router();

const toJob = (r) => ({
  id: r.id,
  queueNumber: r.queue_number,
  fileName: r.file_name,
  fileSize: r.file_size,
  fileType: r.file_type,
  hasFile: Boolean(r.has_file),
  pages: r.pages,
  copies: r.copies,
  color: r.color,
  paperSize: r.paper_size,
  total: r.total,
  payment: r.payment,
  cashReceived: r.cash_received,
  change: r.change_amount,
  changeGiven: Boolean(r.change_given),
  status: r.status,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

const SELECT_JOB = `SELECT j.*, (f.job_id IS NOT NULL) AS has_file
                    FROM print_job j LEFT JOIN print_file f ON f.job_id = j.id`;

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`${SELECT_JOB} ORDER BY j.created_at`);
  res.json(rows.map(toJob));
});

router.post('/', async (req, res) => {
  const j = req.body;
  if (!j.fileName || !(j.pages > 0) || !(j.copies > 0)) throw httpError(400, 'File name, pages and copies are required.');

  const id = await transaction(async (conn) => {
    const queueNumber = await nextNumber(conn, 'print_job', 'queue_number', 'P');
    const [result] = await conn.query(
      `INSERT INTO print_job (queue_number, file_name, file_size, file_type, pages, copies, color, paper_size,
                              total, payment, cash_received, change_amount, change_given)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [queueNumber, j.fileName, j.fileSize ?? null, j.fileType ?? null, j.pages, j.copies, j.color || 'bw',
       j.paperSize || 'Short', j.total, j.payment || 'Cash', j.cashReceived ?? null, j.change ?? null, j.changeGiven ?? false]
    );
    return result.insertId;
  });

  const [rows] = await pool.query(`${SELECT_JOB} WHERE j.id = ?`, [id]);
  res.status(201).json(toJob(rows[0]));
});

// the file itself is sent as raw bytes: PUT /api/print-jobs/:id/file
router.put('/:id/file', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw httpError(400, 'No file received.');
  await pool.query(
    'INSERT INTO print_file (job_id, file) VALUES (?, ?) ON DUPLICATE KEY UPDATE file = VALUES(file)',
    [req.params.id, req.body]
  );
  res.json({ ok: true });
});

router.get('/:id/file', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT f.file, j.file_type, j.file_name FROM print_file f JOIN print_job j ON j.id = f.job_id WHERE f.job_id = ?',
    [req.params.id]
  );
  if (!rows.length) throw httpError(404, 'File not found.');
  res.set('Content-Type', rows[0].file_type || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(rows[0].file_name)}"`);
  res.send(rows[0].file);
});

// body: { status: 'Waiting' | 'Printing' | 'Completed' }
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['Waiting', 'Printing', 'Completed'].includes(status)) throw httpError(400, 'Unknown status.');
  await pool.query(
    'UPDATE print_job SET status = ?, completed_at = IF(? = "Completed", NOW(), completed_at) WHERE id = ?',
    [status, status, req.params.id]
  );
  res.json({ ok: true });
});

router.post('/:id/give-change', async (req, res) => {
  await pool.query('UPDATE print_job SET change_given = TRUE WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM print_job WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
