// Small on-device database (IndexedDB) so chats open instantly and stay readable offline.
// Every call is best effort: if storage is unavailable (private mode, quota) the app just uses the network.
const STORE_KV = 'kv';
const STORE_MSG = 'messages';

let userId = null;
let dbPromise = null;

function open(id) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`chatapp-${id}`, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(STORE_KV);
      const msgs = db.createObjectStore(STORE_MSG, { keyPath: '_id' });
      msgs.createIndex('byConv', ['conversation', 'createdAt']);
      msgs.createIndex('byExpiry', 'expiresAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Runs fn(store) in one transaction and resolves when it completes.
async function run(storeName, mode, fn) {
  if (!dbPromise) return undefined;
  try {
    const db = await dbPromise;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let result;
      Promise.resolve(fn(tx.objectStore(storeName))).then((r) => (result = r));
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch {
    return undefined;
  }
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const localDb = {
  // Selects the database for the signed-in user (call before any other method).
  use(id) {
    if (userId === id) return;
    this.close();
    userId = id;
    if (!id || !('indexedDB' in window)) return;
    dbPromise = open(id).catch(() => null);
    this.purgeExpired();
  },

  close() {
    dbPromise?.then((db) => db?.close()).catch(() => {});
    dbPromise = null;
    userId = null;
  },

  async getKV(key) {
    return run(STORE_KV, 'readonly', (s) => wrap(s.get(key)));
  },

  async setKV(key, value) {
    await run(STORE_KV, 'readwrite', (s) => wrap(s.put(value, key)));
  },

  // Newest first, hiding anything past its server-side expiry.
  async getMessages(conversationId, limit = 30) {
    const now = Date.now();
    const out = await run(STORE_MSG, 'readonly', (s) =>
      new Promise((resolve, reject) => {
        const found = [];
        const range = IDBKeyRange.bound([conversationId, ''], [conversationId, '￿']);
        const cur = s.index('byConv').openCursor(range, 'prev');
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c || found.length >= limit) return resolve(found);
          if (new Date(c.value.expiresAt).getTime() > now) found.push(c.value);
          c.continue();
        };
        cur.onerror = () => reject(cur.error);
      })
    );
    return out || [];
  },

  async putMessages(messages) {
    const rows = messages.filter((m) => m.status !== 'pending' && m.status !== 'failed');
    if (!rows.length) return;
    await run(STORE_MSG, 'readwrite', (s) => {
      rows.forEach((m) => {
        const { localUri, ...clean } = m; // blob URLs do not survive a reload
        s.put(clean);
      });
    });
  },

  async setStatus(ids, status) {
    await run(STORE_MSG, 'readwrite', (s) => {
      ids.forEach((id) => {
        s.get(id).onsuccess = (e) => e.target.result && s.put({ ...e.target.result, status });
      });
    });
  },

  async purgeExpired() {
    await run(STORE_MSG, 'readwrite', (s) => {
      s.index('byExpiry').openCursor(IDBKeyRange.upperBound(new Date().toISOString())).onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
    });
  },

  // Wipes everything for this user (sign out).
  async clear() {
    if (!userId) return;
    const id = userId;
    this.close();
    try {
      indexedDB.deleteDatabase(`chatapp-${id}`);
    } catch {
      /* ignore */
    }
  },
};
