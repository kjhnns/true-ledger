import * as SQLite from 'expo-sqlite';

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
}
