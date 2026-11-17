import { api } from '../api';

// a copy of the database as JSON (print files and logins are not included)
export async function exportAll() {
  return JSON.stringify(await api.get('/data/backup'), null, 2);
}

// erases products, stock, orders and print jobs. Throws if the server refuses.
export async function resetAll() {
  await api.post('/data/reset', { confirm: 'RESET' });
  window.location.reload();
}
