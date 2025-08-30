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
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_entities_label ON entities(label);`
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
      'INSERT INTO entities (label, category, prompt, parent_id, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      cat.label,
      'expense',
      cat.label,
      null,
      now,
      now
    );
    const parent = await db.getFirstAsync<any>(
      'SELECT id FROM entities WHERE rowid = last_insert_rowid()'
    );
    const parentId = parent.id;
    for (const child of cat.children ?? []) {
      await db.runAsync(
        'INSERT INTO entities (label, category, prompt, parent_id, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        child.label,
        'expense',
        child.label,
        parentId,
        now,
        now
      );
    }
  }
}
