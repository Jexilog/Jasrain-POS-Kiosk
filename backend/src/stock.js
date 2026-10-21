import { httpError } from './db.js';

// Changes stock and writes the stock log. Call it inside a transaction.
// changes: [{ barcode, delta } or { barcode, setTo }, reason, note]
export async function applyMovements(conn, changes, by = 'Admin', orderNumber = null) {
  const entries = [];

  for (const c of changes) {
    const [rows] = await conn.query('SELECT stock FROM product WHERE barcode = ? FOR UPDATE', [c.barcode]);
    if (!rows.length) throw httpError(404, `Product ${c.barcode} not found.`);

    const current = rows[0].stock;
    const target = c.setTo != null
      ? Math.max(0, Math.floor(Number(c.setTo)))
      : Math.max(0, current + Math.round(Number(c.delta)));
    const delta = target - current;
    if (delta === 0) continue;

    await conn.query('UPDATE product SET stock = ? WHERE barcode = ?', [target, c.barcode]);
    await conn.query(
      `INSERT INTO stock_movement (barcode, order_number, delta, stock_after, reason, note, done_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.barcode, orderNumber, delta, target, c.reason || 'Adjustment', c.note || null, by]
    );
    entries.push({ barcode: c.barcode, delta, stockAfter: target });
  }
  return entries;
}

// next number like A001 or P001
export async function nextNumber(conn, table, column, prefix) {
  const [rows] = await conn.query(
<<<<<<< HEAD
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${column}, 2) AS UNSIGNED)), 0) + 1 AS n FROM ${table} FOR UPDATE`
=======
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${column}, 2) AS UNSIGNED)), 0) + 1 AS n
     FROM ${table} WHERE ${column} LIKE ? FOR UPDATE`,
    [`${prefix}%`]
>>>>>>> f10357b (Re: First Sprint: Refinement and Connection of Backend and Frontend)
  );
  return prefix + String(rows[0].n).padStart(3, '0');
}
