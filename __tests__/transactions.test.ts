jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { createTransaction, updateTransaction, listTransactions } from '../lib/transactions';
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
});
