import * as SQLite from 'expo-sqlite';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_SAVINGS_CATEGORIES } from './defaultCategories';

const DEFAULT_DB_NAME = 'app_v3.db';
const DB_PATH_STORAGE_KEY = 'db-file-path-v1';

type SecureStoreModule = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync?(key: string): Promise<void>;
};

export type DbFileInfo = {
  path: string;
  directory: string;
  fileName: string;
};

let secureStorePromise: Promise<SecureStoreModule> | null = null;
let cachedLocation: DbFileInfo | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInstance: SQLite.SQLiteDatabase | null = null;

function joinDirectoryAndFile(directory: string, fileName: string): string {
  const trimmedDirectory = directory.replace(/\/+$/, '');
  const trimmedFileName = fileName.replace(/^\/+/, '');
  if (!trimmedDirectory) {
    return trimmedFileName;
  }
  return `${trimmedDirectory}/${trimmedFileName}`;
}

function parseLocation(path: string): DbFileInfo {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return {
      path: normalized,
      directory: '',
      fileName: normalized || DEFAULT_DB_NAME,
    };
  }
  const directory = normalized.slice(0, lastSlash);
  const fileName = normalized.slice(lastSlash + 1) || DEFAULT_DB_NAME;
  return { path: normalized, directory, fileName };
}

function getDefaultDirectory(): string {
  return SQLite.defaultDatabaseDirectory ?? 'SQLite';
}

async function getSecureStore(): Promise<SecureStoreModule> {
  if (!secureStorePromise) {
    secureStorePromise = (async () => {
      try {
        const mod = await import('expo-secure-store');
        if (
          mod &&
          typeof mod.getItemAsync === 'function' &&
          typeof mod.setItemAsync === 'function'
        ) {
          return mod as SecureStoreModule;
        }
      } catch {
        // ignore and fall back to in-memory store
      }
      const memory = new Map<string, string>();
      return {
        async getItemAsync(key: string) {
          return memory.has(key) ? memory.get(key)! : null;
        },
        async setItemAsync(key: string, value: string) {
          memory.set(key, value);
        },
        async deleteItemAsync(key: string) {
          memory.delete(key);
        },
      };
    })();
  }
  return secureStorePromise;
}

async function persistLocation(path: string): Promise<DbFileInfo> {
  const secureStore = await getSecureStore();
  await secureStore.setItemAsync(DB_PATH_STORAGE_KEY, path);
  cachedLocation = parseLocation(path);
  return cachedLocation;
}

async function ensureLocation(): Promise<DbFileInfo> {
  if (cachedLocation) {
    return cachedLocation;
  }
  const secureStore = await getSecureStore();
  let storedPath = await secureStore.getItemAsync(DB_PATH_STORAGE_KEY);
  if (!storedPath) {
    const defaultPath = joinDirectoryAndFile(getDefaultDirectory(), DEFAULT_DB_NAME);
    await secureStore.setItemAsync(DB_PATH_STORAGE_KEY, defaultPath);
    storedPath = defaultPath;
  } else if (!storedPath.includes('/')) {
    const normalized = joinDirectoryAndFile(getDefaultDirectory(), storedPath);
    await secureStore.setItemAsync(DB_PATH_STORAGE_KEY, normalized);
    storedPath = normalized;
  }
  cachedLocation = parseLocation(storedPath);
  return cachedLocation;
}

async function closeDbInstance() {
  const db = dbInstance;
  dbInstance = null;
  dbPromise = null;
  if (db && typeof db.closeAsync === 'function') {
    try {
      await db.closeAsync();
    } catch {
      // ignore close errors
    }
  }
}

async function ensureDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const location = await ensureLocation();
      const directory = location.directory.trim() ? location.directory : undefined;
      const db = await SQLite.openDatabaseAsync(location.fileName, undefined, directory);
      dbInstance = db;
      return db;
    })();
  }
  return dbPromise;
}

export async function getDb() {
  return ensureDb();
}

export async function getDbFileInfo(): Promise<DbFileInfo> {
  const info = await ensureLocation();
  return { ...info };
}

export async function setDbFilePath(path: string): Promise<DbFileInfo> {
  const normalizedPath = path.includes('/')
    ? path
    : joinDirectoryAndFile(getDefaultDirectory(), path);
  await closeDbInstance();
  return persistLocation(normalizedPath);
}

export async function deleteDbFile(): Promise<void> {
  const location = await ensureLocation();
  await closeDbInstance();
  const directory = location.directory.trim() ? location.directory : undefined;
  await SQLite.deleteDatabaseAsync(location.fileName, directory);
}

export async function initDb() {
  const db = await ensureDb();
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
    CREATE INDEX IF NOT EXISTS idx_entities_category ON entities(category);
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
    CREATE INDEX IF NOT EXISTS idx_statements_bank_id ON statements(bank_id);
    CREATE TABLE IF NOT EXISTS transactions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER NOT NULL,
      recipient_id INTEGER,
      sender_id INTEGER,
      created_at INTEGER NOT NULL,
      processed_at INTEGER,
      archived_at INTEGER,
      location TEXT,
      description TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      reviewed_at INTEGER,
      shared INTEGER NOT NULL DEFAULT 0,
      shared_amount REAL
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_reviewed_at ON transactions(reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_sender_id ON transactions(sender_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id ON transactions(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_shared ON transactions(shared);
    CREATE INDEX IF NOT EXISTS idx_transactions_date_reviewed ON transactions(created_at, reviewed_at);`
  );
  await seedDefaultCategories(db);
}

async function seedDefaultCategories(db: SQLite.SQLiteDatabase) {
  const now = Date.now();

  const expenseExisting = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entities WHERE category=?',
    'expense'
  );
  if (!expenseExisting || expenseExisting.count === 0) {
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
      const parent = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM entities WHERE rowid = last_insert_rowid()'
      );
      if (!parent) continue;
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

  const incomeExisting = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entities WHERE category=?',
    'income'
  );
  if (!incomeExisting || incomeExisting.count === 0) {
    for (const label of DEFAULT_INCOME_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO entities (label, category, prompt, parent_id, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        label,
        'income',
        label,
        null,
        'USD',
        now,
        now
      );
    }
  }

  const savingsExisting = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entities WHERE category=?',
    'savings'
  );
  if (!savingsExisting || savingsExisting.count === 0) {
    for (const label of DEFAULT_SAVINGS_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO entities (label, category, prompt, parent_id, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        label,
        'savings',
        label,
        null,
        'USD',
        now,
        now
      );
    }
  }
}
