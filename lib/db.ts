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
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_label ON bank_accounts(label);
    CREATE TABLE IF NOT EXISTS ingestion_jobs(
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_label TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      openai_file_id TEXT NULL,
      model TEXT NULL,
      raw_response_text TEXT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      error TEXT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created ON ingestion_jobs(created_at);`
  );
}
