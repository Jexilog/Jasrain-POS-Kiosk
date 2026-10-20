import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jasrain_kiosk',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as numbers, not strings
});

// runs work(conn) inside a transaction: all changes are saved together or not at all
export async function transaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// error with an HTTP status, e.g. throw httpError(404, 'Product not found')
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
