import * as SQLite from 'expo-sqlite';
// import { generateClassificationKey } from './classification';

const dbPromise = SQLite.openDatabaseAsync('app_v2.db');

export async function getDb() {
  return dbPromise;
}

export async function initDb() {
  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS bank_accounts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      prompt TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_label ON bank_accounts(label);`
  );
  // No classification key logic needed anymore
}
