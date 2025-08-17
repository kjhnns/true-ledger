jest.mock('expo-sqlite', () => {
  const rows: any[] = [];
  return {
    __rows: rows,
    openDatabaseAsync: async () => ({
      execAsync: async () => {},
      getAllAsync: async () => rows,
      getFirstAsync: async (_sql: string, id: string) =>
        rows.find((r) => r.id === id) ?? null,
      runAsync: async (sql: string, ...params: any[]) => {
        if (sql.startsWith('INSERT')) {
          const [id, label, classification_key, prompt, created_at, updated_at] = params;
          rows.push({ id, label, classification_key, prompt, created_at, updated_at });
        } else if (sql.startsWith('UPDATE')) {
          const [label, classification_key, prompt, updated_at, id] = params;
          const row = rows.find((r) => r.id === id);
          if (row) {
            row.label = label;
            row.classification_key = classification_key;
            row.prompt = prompt;
            row.updated_at = updated_at;
          }
        } else if (sql.startsWith('DELETE')) {
          const [id] = params;
          const idx = rows.findIndex((r) => r.id === id);
          if (idx !== -1) rows.splice(idx, 1);
        }
      },
    }),
  };
});

import {
  createBankAccount,
  getBankAccount,
  updateBankAccount,
  deleteBankAccount,
  listBankAccounts,
} from '../lib/bankAccounts';
import { initDb } from '../lib/db';
const sqlite = require('expo-sqlite');

beforeAll(async () => {
  await initDb();
});

beforeEach(() => {
  sqlite.__rows.length = 0;
});

test('create and retrieve bank account', async () => {
  const created = await createBankAccount({
    label: 'Checking',
    prompt: 'hi',
  });
  const fetched = await getBankAccount(created.id);
  expect(fetched?.label).toBe('Checking');
  expect(fetched?.classificationKey).toBe('checking');
});

test('validation fails for missing label', async () => {
  await expect(
    createBankAccount({ label: '', prompt: 'hi' } as any)
  ).rejects.toThrow();
});

test('update modifies label, prompt, and key', async () => {
  const created = await createBankAccount({ label: 'Old', prompt: 'p' });
  await updateBankAccount(created.id, { label: 'New Name', prompt: 'p2' });
  const fetched = await getBankAccount(created.id);
  expect(fetched?.label).toBe('New Name');
  expect(fetched?.prompt).toBe('p2');
  expect(fetched?.classificationKey).toBe('new-name');
});

test('delete removes account', async () => {
  const created = await createBankAccount({
    label: 'Del',
    prompt: 'p',
  });
  await deleteBankAccount(created.id);
  const fetched = await getBankAccount(created.id);
  expect(fetched).toBeNull();
});

test('list returns created accounts', async () => {
  await createBankAccount({ label: 'List', prompt: 'p' });
  const list = await listBankAccounts();
  expect(list.length).toBe(1);
});

test('auto-generated keys are unique', async () => {
  const a = await createBankAccount({ label: 'Dup', prompt: 'p' });
  const b = await createBankAccount({ label: 'Dup', prompt: 'p' });
  expect(a.classificationKey).toBe('dup');
  expect(b.classificationKey).toBe('dup-2');
});
