jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { createStatement, getStatement } from '../lib/statements';
import { createTransaction, updateTransaction, listTransactions, getReviewedAmountProgress } from '../lib/transactions';
import sqliteMock from '../test-utils/sqliteMock';

describe('transactions', () => {
  beforeEach(() => {
    // reset mock db
    // @ts-ignore
    sqliteMock.__reset();
  });

  it('updates shared fields and description', async () => {
    const txn = await createTransaction({
      statementId: '1',
      recipientId: null,
      senderId: null,
      createdAt: Date.now(),
      amount: 100,
      currency: 'USD',
      shared: false,
      description: null,
    });
    await updateTransaction(txn.id, {
      shared: true,
      sharedAmount: 40,
      description: 'Dinner',
    });
    const list = await listTransactions('1');
    expect(list[0]).toMatchObject({
      shared: true,
      sharedAmount: 40,
      description: 'Dinner',
    });
  });

  it('toggles reviewed status and updates statement', async () => {
    const stmt = await createStatement({
      bankId: '1',
      uploadDate: 1,
      status: 'processed',
    });
    const t1 = await createTransaction({
      statementId: stmt.id,
      createdAt: 1,
      amount: 10,
      currency: 'USD',
      shared: false,
    });
    const t2 = await createTransaction({
      statementId: stmt.id,
      createdAt: 2,
      amount: 20,
      currency: 'USD',
      shared: false,
    });
    await updateTransaction(t1.id, { reviewedAt: Date.now() });
    let st = await getStatement(stmt.id);
    expect(st?.status).toBe('processed');
    await updateTransaction(t2.id, { reviewedAt: Date.now() });
    st = await getStatement(stmt.id);
    expect(st?.status).toBe('reviewed');
    await updateTransaction(t2.id, { reviewedAt: null });
    st = await getStatement(stmt.id);
    expect(st?.status).toBe('processed');
  });

  it('calculates reviewed amount progress', () => {
    const txns = [
      { amount: 100, reviewedAt: Date.now() },
      { amount: 50, reviewedAt: null },
      { amount: 25, reviewedAt: Date.now() },
    ] as any;
    const res = getReviewedAmountProgress(txns);
    expect(res.total).toBe(175);
    expect(res.reviewed).toBe(125);
    expect(res.percent).toBeCloseTo(125 / 175);
  });

  it('handles empty transaction list', () => {
    const res = getReviewedAmountProgress([]);
    expect(res).toEqual({ total: 0, reviewed: 0, percent: 0 });
  });
});
