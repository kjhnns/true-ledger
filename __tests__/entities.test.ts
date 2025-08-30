jest.mock('expo-sqlite', () => {
  const rows: any[] = [];
  let id = 1;
  return {
    __rows: rows,
    __reset: () => {
      rows.length = 0;
      id = 1;
    },
    openDatabaseAsync: async () => ({
      execAsync: async () => {},
      getAllAsync: async (_sql: string, category: string) =>
        rows.filter((r) => r.category === category),
      getFirstAsync: async (sql: string, param?: any) => {
        if (sql.startsWith('SELECT COUNT(*)')) {
          return { count: rows.filter((r) => r.category === param).length };
        }
        if (sql.includes('rowid = last_insert_rowid()')) {
          return rows[rows.length - 1] ?? null;
        }
        if (sql.includes('WHERE id=?')) {
          return rows.find((r) => r.id === param) ?? null;
        }
        return null;
      },
      runAsync: async (sql: string, ...params: any[]) => {
        if (sql.startsWith('INSERT INTO entities')) {
          const [label, category, prompt, parent_id, created_at, updated_at] = params;
          rows.push({
            id: String(id++),
            label,
            category,
            prompt,
            parent_id,
            created_at,
            updated_at,
          });
        } else if (sql.startsWith('UPDATE entities')) {
          const [label, category, prompt, parent_id, updated_at, idParam] = params;
          const row = rows.find((r) => r.id === idParam);
          if (row) {
            row.label = label;
            row.category = category;
            row.prompt = prompt;
            row.parent_id = parent_id;
            row.updated_at = updated_at;
          }
        } else if (sql.startsWith('DELETE FROM entities')) {
          const [idParam] = params;
          const idx = rows.findIndex((r) => r.id === idParam);
          if (idx !== -1) rows.splice(idx, 1);
        }
      },
    }),
  };
});

import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  listBankAccounts,
  listEntities,
  updateBankAccount,
} from '../lib/entities';
import { initDb } from '../lib/db';
const sqlite = require('expo-sqlite');

beforeEach(async () => {
  sqlite.__reset();
  await initDb();
});

test('seeds default expense categories', async () => {
  const expenses = await listEntities('expense');
  expect(expenses.find((c) => c.label === 'Food')).toBeTruthy();
  expect(expenses.find((c) => c.label === 'Groceries')).toBeTruthy();
});

test('create, update, delete bank account', async () => {
  const created = await createBankAccount({ label: 'Checking', prompt: 'p' });
  const fetched = await getBankAccount(created.id);
  expect(fetched?.category).toBe('bank');
  await updateBankAccount(created.id, { label: 'New', prompt: 'p2' });
  const updated = await getBankAccount(created.id);
  expect(updated?.label).toBe('New');
  await deleteBankAccount(created.id);
  const list = await listBankAccounts();
  expect(list.length).toBe(0);
});
