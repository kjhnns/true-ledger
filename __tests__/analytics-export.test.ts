jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { createStatement } from '../lib/statements';
import { createExpenseCategory, createEntity } from '../lib/entities';
import { createTransaction } from '../lib/transactions';
import { exportReviewedTransactionsToCsv } from '../lib/analytics';
import sqliteMock from '../test-utils/sqliteMock';

describe('exportReviewedTransactionsToCsv', () => {
  beforeEach(() => {
    // @ts-ignore
    sqliteMock.__reset();
  });

  it('exports reviewed transactions with entity keys', async () => {
    const parent = await createExpenseCategory({
      label: 'Food and Drink',
      prompt: 'Food and Drink',
      parentId: null,
    });
    const child = await createExpenseCategory({
      label: 'Groceries Store',
      prompt: 'Groceries Store',
      parentId: parent.id,
    });
    const income = await createEntity({
      label: 'Salary',
      category: 'income',
      prompt: '',
      parentId: null,
      currency: 'USD',
    });
    const stmt = await createStatement({ bankId: '1', uploadDate: 1, status: 'new' });
    const now = Date.now();
    await createTransaction({
      statementId: stmt.id,
      senderId: income.id,
      recipientId: child.id,
      createdAt: now - 1000,
      amount: 100,
      currency: 'USD',
      shared: false,
      reviewedAt: now - 1000,
      description: 'Groceries',
    });
    await createTransaction({
      statementId: stmt.id,
      senderId: income.id,
      recipientId: child.id,
      createdAt: now - 500,
      amount: 50,
      currency: 'USD',
      shared: false,
    });

    const csv = await exportReviewedTransactionsToCsv(now - 2000, now);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('id,date,description,amount,sender,recipient');
    expect(lines).toHaveLength(2);
    const row = lines[1].split(',');
    expect(row[3]).toBe('100');
    expect(row[4]).toBe('income_salary');
    expect(row[5]).toBe('expense_foodAndDrink_groceriesStore');
  });
});
