import * as SQLite from 'expo-sqlite';
import { generateClassificationKey } from './classification';

const dbPromise = SQLite.openDatabaseAsync('app.db');

export async function getDb() {
  return dbPromise;
}

export async function initDb() {
  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS bank_accounts(
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      classification_key TEXT NULL,
      prompt TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_label ON bank_accounts(label);`
  );
  const rows = await db.getAllAsync<{ id: string; label: string; classification_key: string | null }>(
    'SELECT id,label,classification_key FROM bank_accounts'
  );
  const keys = new Set<string>();
  for (const row of rows) {
    const key = generateClassificationKey(row.label, keys);
    if (row.classification_key !== key) {
      await db.runAsync('UPDATE bank_accounts SET classification_key=? WHERE id=?', key, row.id);
    }
  }
}
