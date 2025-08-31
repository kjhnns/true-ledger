jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { initDb } from '../lib/db';
import {
  createBankAccount,
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
} from '../lib/entities';
import {
  createDummyStatementWithTransactions,
  createStatement,
  listStatementsWithMeta,
} from '../lib/statements';
import { createTransaction, listTransactions } from '../lib/transactions';
const sqlite = require('expo-sqlite');

beforeEach(async () => {
  sqlite.__reset();
  await initDb();
});

test('statement listing shows transaction count and bank label', async () => {
  const bank = await createBankAccount({
    label: 'Bank',
    prompt: 'p',
    currency: 'USD',
  });
  const stmt = await createStatement({
    bankId: bank.id,
    uploadDate: 1,
    status: 'new',
  });
  await createTransaction({
    statementId: stmt.id,
    createdAt: 1,
    amount: 100,
    currency: 'USD',
    shared: false,
  });
  await createTransaction({
    statementId: stmt.id,
    createdAt: 2,
    amount: 200,
    currency: 'USD',
    shared: false,
  });
  const statements = await listStatementsWithMeta();
  expect(statements[0].transactionCount).toBe(2);
  expect(statements[0].bankLabel).toBe('Bank');
  expect(statements[0].earliest).toBe(1);
  expect(statements[0].latest).toBe(2);
});

test('reject negative transaction amount', async () => {
  const bank = await createBankAccount({
    label: 'B',
    prompt: 'p',
    currency: 'USD',
  });
  const stmt = await createStatement({ bankId: bank.id, uploadDate: 1, status: 'new' });
  await expect(
    createTransaction({
      statementId: stmt.id,
      createdAt: 1,
      amount: -5,
      currency: 'USD',
      shared: false,
    })
  ).rejects.toThrow();
});

test('dummy upload creates statement with transactions', async () => {
  const bank = await createBankAccount({
    label: 'Bank',
    prompt: 'p',
    currency: 'USD',
  });
  await createExpenseCategory({ label: 'E1', prompt: 'p', parentId: null });
  await createExpenseCategory({ label: 'E2', prompt: 'p', parentId: null });
  const stmt = await createDummyStatementWithTransactions(bank.id, 'f.pdf');
  const txns = await listTransactions(stmt.id);
  expect(txns).toHaveLength(10);
  for (const t of txns) {
    expect(t.senderId).toBe(bank.id);
  }
});

test('dummy upload rejects when no expense categories', async () => {
  const bank = await createBankAccount({
    label: 'Bank',
    prompt: 'p',
    currency: 'USD',
  });
  const cats = await listExpenseCategories();
  for (const c of cats) {
    await deleteExpenseCategory(c.id);
  }
  await expect(
    createDummyStatementWithTransactions(bank.id, 's.pdf')
  ).rejects.toThrow('No expense categories');
});

test('dummy upload rejects non pdf', async () => {
  const bank = await createBankAccount({
    label: 'Bank',
    prompt: 'p',
    currency: 'USD',
  });
  await createExpenseCategory({ label: 'E', prompt: 'p', parentId: null });
  await expect(
    createDummyStatementWithTransactions(bank.id, 'file.txt')
  ).rejects.toThrow('Only PDF');
});
