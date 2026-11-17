import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { attachUser } from './auth.js';
import auth from './routes/auth.js';
import products from './routes/products.js';
import productImages from './routes/productImages.js';
import stock from './routes/stock.js';
import orders from './routes/orders.js';
import printJobs from './routes/printJobs.js';
import incoming from './routes/incoming.js';
import settings from './routes/settings.js';
import data from './routes/data.js';

const app = express();
// FRONTEND_URL can hold several addresses separated by commas,
// e.g. https://your-site.up.railway.app,http://localhost:5173
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '5mb' }));
app.use(attachUser);

app.get('/api/health', (req, res, next) => {
  pool.query('SELECT 1').then(() => res.json({ ok: true })).catch(next);
});

app.use('/api/auth', auth);
app.use('/api/products', productImages);
app.use('/api/products', products);
app.use('/api/stock', stock);
app.use('/api/orders', orders);
app.use('/api/print-jobs', printJobs);
app.use('/api/incoming', incoming);
app.use('/api/settings', settings);
app.use('/api/data', data);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
