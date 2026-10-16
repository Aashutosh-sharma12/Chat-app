import * as SQLite from 'expo-sqlite';
import type { Message } from '@/types';

// On-device SQLite database so chats open instantly and stay readable offline.
// Every call is best effort: if the database cannot be opened the app simply uses the network.
let owner: string | null = null;
let opening: Promise<SQLite.SQLiteDatabase | null> | null = null;

const dbName = (userId: string) => `chat-${userId}.db`;

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages (expiresAt);
`;

async function withDb<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>, fallback: T): Promise<T> {
  try {
    const db = await opening;
    return db ? await fn(db) : fallback;
  } catch {
    return fallback;
  }
}

export const localDb = {
  // Selects the database for the signed-in user (call before any other method).
  use(userId: string) {
    if (owner === userId) return;
    this.close();
    owner = userId;
    opening = SQLite.openDatabaseAsync(dbName(userId))
      .then(async (db) => {
        await db.execAsync(SCHEMA);
        return db;
      })
      .catch(() => null);
    this.purgeExpired();
  },

  close() {
    const pending = opening;
    opening = null;
    owner = null;
    pending?.then((db) => db?.closeAsync()).catch(() => {});
  },

  getKV<T>(key: string): Promise<T | null> {
    return withDb(async (db) => {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row ? (JSON.parse(row.value) as T) : null;
    }, null);
  },

  setKV(key: string, value: unknown) {
    return withDb(async (db) => {
      await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
    }, undefined);
  },

  // Newest first, hiding anything past its server-side expiry.
  getMessages(conversationId: string, limit = 30): Promise<Message[]> {
    return withDb(async (db) => {
      const rows = await db.getAllAsync<{ json: string }>(
        'SELECT json FROM messages WHERE conversation = ? AND expiresAt > ? ORDER BY createdAt DESC LIMIT ?',
        conversationId,
        new Date().toISOString(),
        limit
      );
      return rows.map((r) => JSON.parse(r.json) as Message);
    }, []);
  },

  putMessages(messages: Message[]) {
    const rows = messages.filter((m) => m.status !== 'pending' && m.status !== 'failed');
    if (rows.length === 0) return Promise.resolve();
    return withDb(async (db) => {
      await db.withTransactionAsync(async () => {
        for (const m of rows) {
          // Local file URIs of unsent media are not worth keeping once the server has the file.
          const { localUri: _localUri, localMime: _localMime, ...clean } = m;
          await db.runAsync(
            'INSERT OR REPLACE INTO messages (id, conversation, createdAt, expiresAt, json) VALUES (?, ?, ?, ?, ?)',
            m._id,
            m.conversation,
            m.createdAt,
            m.expiresAt,
            JSON.stringify(clean)
          );
        }
      });
    }, undefined);
  },

  setStatus(ids: string[], status: string) {
    if (ids.length === 0) return Promise.resolve();
    return withDb(async (db) => {
      const marks = ids.map(() => '?').join(',');
      await db.runAsync(`UPDATE messages SET json = json_set(json, '$.status', ?) WHERE id IN (${marks})`, status, ...ids);
    }, undefined);
  },

  purgeExpired() {
    return withDb(async (db) => {
      await db.runAsync('DELETE FROM messages WHERE expiresAt <= ?', new Date().toISOString());
    }, undefined);
  },

  // Wipes everything for this user (sign out).
  async clear() {
    const id = owner;
    if (!id) return;
    const pending = opening;
    opening = null;
    owner = null;
    try {
      (await pending)?.closeAsync();
      await SQLite.deleteDatabaseAsync(dbName(id));
    } catch {
      /* nothing to delete */
    }
  },
};
