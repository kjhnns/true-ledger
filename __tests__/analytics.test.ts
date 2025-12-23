jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { createStatement } from '../lib/statements';
import { createExpenseCategory, createEntity } from '../lib/entities';
import { createTransaction } from '../lib/transactions';
import { summarizeExpensesByParent, computeKeyMetrics, summarizeReviewedTransactionsByBank } from '../lib/analytics';
import { initDb } from '../lib/db';
import sqliteMock from '../test-utils/sqliteMock';

describe('analytics', () => {
  beforeEach(async () => {
    // @ts-ignore
    sqliteMock.__reset();
    await initDb();
  });

  it('summarizes expenses by top-level parent', async () => {
    const food = await createExpenseCategory({ label: 'Food', prompt: 'Food', parentId: null });
    const grocery = await createExpenseCategory({ label: 'Groceries', prompt: 'Groceries', parentId: food.id });
    const transport = await createExpenseCategory({ label: 'Transport', prompt: 'Transport', parentId: null });
    const bus = await createExpenseCategory({ label: 'Bus', prompt: 'Bus', parentId: transport.id });
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({
      statementId: stmt.id,
      recipientId: grocery.id,
      senderId: null,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 1000,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: bus.id,
      senderId: null,
      createdAt: now - 500,
      amount: 50,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 500,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: bus.id,
      senderId: null,
      createdAt: now - 250,
      amount: 25,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 250,
    });

    const res = await summarizeExpensesByParent(now - 2000, now);
    expect(res).toEqual([
      { parentId: food.id, parentLabel: 'Food', total: 100 },
      { parentId: transport.id, parentLabel: 'Transport', total: 75 },
    ]);
  });

  it('ignores unreviewed expenses', async () => {
    const food = await createExpenseCategory({ label: 'Food', prompt: 'Food', parentId: null });
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({
      statementId: stmt.id,
      recipientId: food.id,
      senderId: null,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 1000,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: food.id,
      senderId: null,
      createdAt: now - 500,
      amount: 50,
      currency: 'USD',
      shared: false,
    });

    const res = await summarizeExpensesByParent(now - 2000, now);
    expect(res).toEqual([
      { parentId: food.id, parentLabel: 'Food', total: 100 },
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
      reviewedAt: now - 1000,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: food.id,
      senderId: null,
      createdAt: now - 900,
      amount: 30,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 900,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: save.id,
      senderId: null,
      createdAt: now - 800,
      amount: 20,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 800,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: null,
      senderId: save.id,
      createdAt: now - 700,
      amount: 5,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 700,
    });
    await createTransaction({
      statementId: stmt.id,
      recipientId: food.id,
      senderId: null,
      createdAt: now - 600,
      amount: 40,
      currency: 'USD',
      shared: true,
      sharedAmount: 10,
      reviewedAt: now - 600,
    });

    const res = await computeKeyMetrics(now - 2000, now, [salary.id], [save.id]);
    expect(res).toEqual({
      income: 100,
      expenses: 70,
      savings: 15,
      cashflow: 30,
      savingsRatio: 0.15,
      splitCredit: 30,
    });
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
      reviewedAt: now - 1000,
    });
    const res = await computeKeyMetrics(now - 2000, now, [], []);
    expect(res).toEqual({
      income: 0,
      expenses: 0,
      savings: 0,
      cashflow: 0,
      savingsRatio: 0,
      splitCredit: 0,
    });
  });

  it('ignores unreviewed transactions', async () => {
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
      reviewedAt: now - 1000,
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
      recipientId: food.id,
      senderId: null,
      createdAt: now - 850,
      amount: 40,
      currency: 'USD',
      shared: true,
      sharedAmount: 15,
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

    const res = await computeKeyMetrics(now - 2000, now, [salary.id], [save.id]);
    expect(res).toEqual({
      income: 100,
      expenses: 0,
      savings: 0,
      cashflow: 100,
      savingsRatio: 0,
      splitCredit: 0,
    });
  });

  it('summarizes reviewed transactions by bank account', async () => {
    const bank1 = await createEntity({
      label: 'Bank1',
      category: 'bank',
      prompt: '',
      parentId: null,
      currency: 'USD',
    });
    const bank2 = await createEntity({
      label: 'Bank2',
      category: 'bank',
      prompt: '',
      parentId: null,
      currency: 'USD',
    });
    const stmt1 = await createStatement({ bankId: bank1.id, uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({
      statementId: stmt1.id,
      recipientId: null,
      senderId: null,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 1000,
    });
    await createTransaction({
      statementId: stmt1.id,
      recipientId: null,
      senderId: null,
      createdAt: now - 500,
      amount: 50,
      currency: 'USD',
      shared: false,
    });
    await createTransaction({
      statementId: stmt1.id,
      recipientId: null,
      senderId: null,
      createdAt: now - 5000,
      amount: 75,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 5000,
    });

    const res = await summarizeReviewedTransactionsByBank(now - 2000, now);
    // Find the results for Bank1 and Bank2 (Main is also seeded by initDb)
    const bank1Result = res.find((r) => r.bankLabel === 'Bank1');
    const bank2Result = res.find((r) => r.bankLabel === 'Bank2');
    expect(bank1Result).toEqual({ bankId: bank1.id, bankLabel: 'Bank1', count: 1, total: 100 });
    expect(bank2Result).toEqual({ bankId: bank2.id, bankLabel: 'Bank2', count: 0, total: 0 });
  });
});
