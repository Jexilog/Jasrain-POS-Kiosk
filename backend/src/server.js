import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import products from './routes/products.js';
import stock from './routes/stock.js';
import orders from './routes/orders.js';
import printJobs from './routes/printJobs.js';
import settings from './routes/settings.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res, next) => {
  pool.query('SELECT 1').then(() => res.json({ ok: true })).catch(next);
});

app.use('/api/products', products);
app.use('/api/stock', stock);
app.use('/api/orders', orders);
app.use('/api/print-jobs', printJobs);
app.use('/api/settings', settings);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
