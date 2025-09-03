jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { createStatement } from '../lib/statements';
import { createExpenseCategory, createEntity } from '../lib/entities';
import { createTransaction } from '../lib/transactions';
import { summarizeExpensesByParent, computeKeyMetrics } from '../lib/analytics';
import sqliteMock from '../test-utils/sqliteMock';

describe('analytics', () => {
  beforeEach(() => {
    // @ts-ignore
    sqliteMock.__reset();
  });

  it('summarizes expenses by top-level parent', async () => {
    const food = await createExpenseCategory({ label: 'Food', prompt: 'Food', parentId: null });
    const grocery = await createExpenseCategory({ label: 'Groceries', prompt: 'Groceries', parentId: food.id });
    const transport = await createExpenseCategory({ label: 'Transport', prompt: 'Transport', parentId: null });
    const bus = await createExpenseCategory({ label: 'Bus', prompt: 'Bus', parentId: transport.id });
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({ statementId: stmt.id, recipientId: grocery.id, senderId: null, createdAt: now - 1000, amount: 100, currency: 'USD', shared: false });
    await createTransaction({ statementId: stmt.id, recipientId: bus.id, senderId: null, createdAt: now - 500, amount: 50, currency: 'USD', shared: false });
    await createTransaction({ statementId: stmt.id, recipientId: bus.id, senderId: null, createdAt: now - 250, amount: 25, currency: 'USD', shared: false });

    const res = await summarizeExpensesByParent(now - 2000, now);
    expect(res).toEqual([
      { parentId: food.id, parentLabel: 'Food', total: 100 },
      { parentId: transport.id, parentLabel: 'Transport', total: 75 },
    ]);
  });

  it('computes key metrics', async () => {
    const salary = await createEntity({
      label: 'Salary',
      category: 'income',
      prompt: 'Salary',
      parentId: null,
      currency: 'USD',
    });
    const save = await createEntity({
      label: 'Save',
      category: 'savings',
      prompt: 'Save',
      parentId: null,
      currency: 'USD',
    });
    const food = await createExpenseCategory({
      label: 'Food',
      prompt: 'Food',
      parentId: null,
    });
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({
      statementId: stmt.id,
      senderId: salary.id,
      recipientId: null,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: food.id,
      senderId: null,
      createdAt: now - 900,
      amount: 30,
      currency: 'USD',
      shared: false,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: save.id,
      senderId: null,
      createdAt: now - 800,
      amount: 20,
      currency: 'USD',
      shared: false,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: null,
      senderId: save.id,
      createdAt: now - 700,
      amount: 5,
      currency: 'USD',
      shared: false,
    });

    const res = await computeKeyMetrics(now - 2000, now, [salary.id], [save.id]);
    expect(res).toEqual({ income: 100, expenses: 30, savings: 15, cashflow: 70 });
  });

  it('returns zeros when no matching entities', async () => {
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    const salary = await createEntity({
      label: 'Salary',
      category: 'income',
      prompt: 'Salary',
      parentId: null,
      currency: 'USD',
    });
    await createTransaction({
      statementId: stmt.id,
      senderId: salary.id,
      recipientId: null,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
    });
    const res = await computeKeyMetrics(now - 2000, now, [], []);
    expect(res).toEqual({ income: 0, expenses: 0, savings: 0, cashflow: 0 });
  });
});
