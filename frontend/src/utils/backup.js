// all the data this app saves in the browser (for backup and restore)
export const STORAGE_KEYS = [
  'jasrain_products',
  'jasrain_stock_log',
  'jasrain_orders',
  'jasrain_print_queue',
  'jasrain_settings',
];

export function exportAll() {
  const data = {};
  STORAGE_KEYS.forEach((k) => {
    try {
      const raw = localStorage.getItem(k);
      if (raw) data[k] = JSON.parse(raw);
    } catch (e) {
      /* skip unreadable key */
    }
  });
  return JSON.stringify({ app: 'jasrain-kiosk', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

// returns { ok, message }, reloads the page on success
export async function importAll(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (e) {
    return { ok: false, message: 'That file is not a valid backup.' };
  }
  if (!parsed || parsed.app !== 'jasrain-kiosk' || typeof parsed.data !== 'object') {
    return { ok: false, message: 'This is not a Jasrain backup file.' };
  }
  const keys = Object.keys(parsed.data).filter((k) => STORAGE_KEYS.includes(k));
  if (!keys.length) return { ok: false, message: 'The backup is empty.' };
  try {
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    keys.forEach((k) => localStorage.setItem(k, JSON.stringify(parsed.data[k])));
  } catch (e) {
    return { ok: false, message: 'Could not save the backup (browser storage is full or blocked).' };
  }
  window.location.reload();
  return { ok: true, message: 'Restored.' };
}

export function resetAll() {
  STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  try {
    indexedDB.deleteDatabase('jasrain_files');
  } catch (e) {
    /* ignore */
  }
  window.location.reload();
}
