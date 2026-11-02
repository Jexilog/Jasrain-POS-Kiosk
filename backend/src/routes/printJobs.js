import crypto from 'node:crypto';
import express from 'express';
import { Router } from '../asyncRouter.js';
import { pool, transaction, httpError } from '../db.js';
import { requireAdminOrStaff} from '../auth.js';
import { nextNumber } from '../stock.js';

const router = Router();
const money = (n) => Math.round(n * 100) / 100;

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
  ...(r.completed_at ? { completedAt: r.completed_at } : {}),
  demo: Boolean(r.is_demo),
  archived: Boolean(r.archived),
});

const SELECT_JOB = `SELECT j.*, (f.job_id IS NOT NULL) AS has_file
                    FROM print_job j LEFT JOIN print_file f ON f.job_id = j.id`;

// Customers can see the queue numbers and statuses, nothing else
router.get('/board', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, queue_number, status, created_at FROM print_job WHERE status IN ('Waiting', 'Printing') AND archived = FALSE ORDER BY created_at, id"
  );
  res.json(rows.map((r) => ({ id: r.id, queueNumber: r.queue_number, status: r.status, createdAt: r.created_at })));
});

router.get('/', requireAdminOrStaff, async (req, res) => {
  const [rows] = await pool.query(`${SELECT_JOB} ORDER BY j.created_at, j.id`);
  res.json(rows.map(toJob));
});

// The kiosk calls this. The price comes from the saved print rates.
router.post('/', async (req, res) => {
  const j = req.body;
  const pages = Math.floor(Number(j.pages));
  const copies = Math.floor(Number(j.copies));
  if (!j.fileName) throw httpError(400, 'File name is required.');
  if (!(pages > 0 && pages <= 2000)) throw httpError(400, 'Pages must be between 1 and 2000.');
  if (!(copies > 0 && copies <= 100)) throw httpError(400, 'Copies must be between 1 and 100.');
  const color = j.color === 'color' ? 'color' : 'bw';

  // the kiosk that makes the job gets a one-time key, and only that key can upload the file
  const uploadToken = crypto.randomBytes(16).toString('hex');

  const id = await transaction(async (conn) => {
    const [[rates]] = await conn.query('SELECT bw_rate, color_rate FROM settings WHERE id = 1');
    const total = money(pages * copies * (color === 'color' ? rates.color_rate : rates.bw_rate));

    let received = null;
    let change = null;
    if (j.cashReceived != null) {
      received = Number(j.cashReceived);
      if (!(received >= total)) throw httpError(400, 'The cash received is less than the total.');
      change = money(received - total);
    }

    const queueNumber = await nextNumber(conn, 'print_job', 'queue_number', 'P');
    const [result] = await conn.query(
      `INSERT INTO print_job (queue_number, upload_token, file_name, file_size, file_type, pages, copies, color, paper_size,
                              total, payment, cash_received, change_amount, change_given)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [queueNumber, uploadToken, String(j.fileName).slice(0, 255), j.fileSize ?? null, j.fileType ?? null, pages, copies, color,
       j.paperSize || 'Short', total, j.payment || 'Cash', received, change, change === 0]
    );
    return result.insertId;
  });

  const [rows] = await pool.query(`${SELECT_JOB} WHERE j.id = ?`, [id]);
  // the key is only given here, to the kiosk that made the job (the staff list never has it)
  res.status(201).json({ ...toJob(rows[0]), uploadToken });
});

// The kiosk sends the file as raw bytes right after creating the job, with the key it was given
// (header X-Upload-Token). The key works once, so nobody can attach a file to someone else's job.
router.put('/:id/file', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw httpError(400, 'No file received.');
  const token = String(req.headers['x-upload-token'] || '');

  await transaction(async (conn) => {
    const [job] = await conn.query('SELECT upload_token FROM print_job WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!job.length) throw httpError(404, 'Print job not found.');
    if (!token || job[0].upload_token !== token) throw httpError(403, 'This job cannot take a file.');
    await conn.query('INSERT INTO print_file (job_id, file) VALUES (?, ?)', [req.params.id, req.body]);
    await conn.query('UPDATE print_job SET upload_token = NULL WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
});

router.get('/:id/file', requireAdminOrStaff, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT f.file, j.file_type, j.file_name FROM print_file f JOIN print_job j ON j.id = f.job_id WHERE f.job_id = ?',
    [req.params.id]
  );
  if (!rows.length) throw httpError(404, 'File not found.');
  res.set('Content-Type', rows[0].file_type || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(rows[0].file_name)}"`);
  res.send(rows[0].file);
});

router.delete('/:id/file', requireAdminOrStaff, async (req, res) => {
  await pool.query('DELETE FROM print_file WHERE job_id = ?', [req.params.id]);
  res.json({ ok: true });
});

// body: { status: 'Waiting' | 'Printing' | 'Completed' }
router.patch('/:id/status', requireAdminOrStaff, async (req, res) => {
  const { status } = req.body;
  if (!['Waiting', 'Printing', 'Completed'].includes(status)) throw httpError(400, 'Unknown status.');
  await pool.query(
    "UPDATE print_job SET status = ?, created_at = IF(? = 'Completed', NOW(), created_at) WHERE id = ?",
    [status, status, req.params.id]
  );
  res.json({ ok: true });
});

router.post('/:id/give-change', requireAdminOrStaff, async (req, res) => {
  await pool.query('UPDATE print_job SET change_given = TRUE WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// "Remove" hides the job from the staff list and deletes its file. The sale stays in the database and the reports.
router.delete('/:id', requireAdminOrStaff, async (req, res) => {
  await transaction(async (conn) => {
    const [rows] = await conn.query('SELECT change_amount, change_given FROM print_job WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw httpError(404, 'Print job not found.');
    if (rows[0].change_amount > 0 && !rows[0].change_given) throw httpError(409, 'Give the customer their change first.');
    await conn.query('DELETE FROM print_file WHERE job_id = ?', [req.params.id]);
    await conn.query('UPDATE print_job SET archived = TRUE, upload_token = NULL WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
});

export default router;
