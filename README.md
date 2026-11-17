# Jasrain kiosk

```
jasrain-kiosk/
  frontend/   React app (kiosk, staff and admin screens)
  backend/    Express API + MySQL database
```

## 1. Database

Open `backend/database/jasrain_kiosk.sql` in MySQL Workbench and run it (lightning bolt).
It creates the `jasrain_kiosk` database, 8 tables, 10 starter products and the first login
**admin / admin123**.

## 2. Backend

```
cd backend
copy .env.example .env     (type your MySQL password and a long random AUTH_SECRET in .env)
npm install
npm run dev
```

Check http://localhost:4000/api/health. It should show `{"ok":true}`.

Add a user or change a password:

```
node scripts/create-user.js admin MyNewPassword
node scripts/create-user.js cashier Secret123 Staff
```

## 3. Frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite sends every `/api` request to the backend on port 4000.

## Who can do what

| | Kiosk (no login) | Staff / admin (login) |
|---|---|---|
| See products | active ones, no cost | all, with cost |
| Place an order, add a print job | yes | yes |
| See the print queue | numbers and status only | everything |
| Orders list, mark paid, cancel | no | yes |
| Products, stock, settings, backup | no | yes |

Prices and totals are worked out by the server, so the browser cannot change them.

## API

| Route | What it does |
|---|---|
| POST `/api/auth/login`, GET `/api/auth/me` | sign in, check the login |
| GET, POST `/api/products` | list, add |
| PUT, DELETE `/api/products/:barcode` | edit, delete (blocked if it has sales) |
| PATCH `/api/products/:barcode/active` | hide or show on the kiosk |
| POST `/api/products/import` | import rows from a CSV |
| POST `/api/stock/adjust`, GET `/api/stock/log` | change stock, stock history |
| GET, POST `/api/orders` | list, place an order (takes stock out) |
| POST `/api/orders/:orderNumber/pay`, `/cancel`, `/give-change` | staff actions |
| GET `/api/print-jobs/board`, GET, POST `/api/print-jobs` | public queue, full list, new job |
| PUT, GET, DELETE `/api/print-jobs/:id/file` | upload, open, delete the file |
| PATCH `/api/print-jobs/:id/status` | Waiting, Printing, Completed |
| GET, PUT `/api/settings` | print rates and default critical level |
| POST, DELETE `/api/data/demo`, GET `/api/data/backup`, POST `/api/data/reset` | sample data, backup, erase |
