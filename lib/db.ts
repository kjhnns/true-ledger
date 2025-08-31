import * as SQLite from 'expo-sqlite';
import { DEFAULT_EXPENSE_CATEGORIES } from './defaultCategories';

const dbPromise = SQLite.openDatabaseAsync('app_v2.db');

export async function getDb() {
  return dbPromise;
}

export async function initDb() {
  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS entities(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      prompt TEXT NOT NULL,
      parent_id INTEGER,
      currency TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_entities_label ON entities(label);
    CREATE TABLE IF NOT EXISTS statements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL,
      upload_date INTEGER NOT NULL,
      file TEXT,
      external_file_id TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      processed_at INTEGER,
      reviewed_at INTEGER,
      published_at INTEGER,
      archived_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_statements_upload_date ON statements(upload_date);
    CREATE TABLE IF NOT EXISTS transactions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER NOT NULL,
      recipient_id INTEGER,
      sender_id INTEGER,
      created_at INTEGER NOT NULL,
      processed_at INTEGER,
      archived_at INTEGER,
      location TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      reviewed_at INTEGER,
      shared INTEGER NOT NULL DEFAULT 0,
      shared_amount REAL
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);`
  );
  await seedDefaultCategories(db);
}

async function seedDefaultCategories(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entities WHERE category=?',
    'expense'
  );
  if (existing && existing.count > 0) return;
  const now = Date.now();
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO entities (label, category, prompt, parent_id, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      cat.label,
      'expense',
      cat.label,
      null,
      'USD',
      now,
      now
    );
    const parent = await db.getFirstAsync<any>(
      'SELECT id FROM entities WHERE rowid = last_insert_rowid()'
    );
    const parentId = parent.id;
    for (const child of cat.children ?? []) {
      await db.runAsync(
        'INSERT INTO entities (label, category, prompt, parent_id, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        child.label,
        'expense',
        child.label,
        parentId,
        'USD',
        now,
        now
      );
    }
  }
}
