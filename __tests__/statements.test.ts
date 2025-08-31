jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { initDb } from '../lib/db';
import { createBankAccount } from '../lib/entities';
import {
  createStatement,
  listStatementsWithMeta,
} from '../lib/statements';
import { createTransaction } from '../lib/transactions';
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
