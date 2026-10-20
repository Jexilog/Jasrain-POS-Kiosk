// Stores uploaded print files in IndexedDB on this computer.
// The kiosk and staff screens must run on the same PC and browser.
const DB_NAME = 'jasrain_files';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export const saveFile = (id, file) =>
  run('readwrite', (s) => s.put({ blob: file, name: file.name, type: file.type }, String(id)));

export const getFile = (id) => run('readonly', (s) => s.get(String(id)));

export const deleteFile = (id) => run('readwrite', (s) => s.delete(String(id)));
