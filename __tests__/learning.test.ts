jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

const mockResponsesCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
  }));
});

import { learnFromTransactions } from '../lib/openai';
import { prepareLearningTransactions, LearnTxn } from '../lib/learn';

describe('learnFromTransactions', () => {
  beforeEach(() => {
    // @ts-ignore
    require('expo-sqlite').__reset();
    mockResponsesCreate.mockReset();
  });

  it('returns updated prompt', async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: 'new prompt' });
    const res = await learnFromTransactions({
      bankPrompt: 'old',
      transactions: [
        { description: 'd', amount: 1, shared: false, category: 'Food', type: 'debit' },
      ],
      apiKey: 'sk',
    });
    expect(res).toBe('new prompt');
    expect(mockResponsesCreate).toHaveBeenCalled();
  });

  it('throws on error response', async () => {
    mockResponsesCreate.mockRejectedValue(new Error('bad'));
    await expect(
      learnFromTransactions({ bankPrompt: '', transactions: [], apiKey: 'sk' })
    ).rejects.toThrow();
    expect(mockResponsesCreate).toHaveBeenCalled();
  });

  it('throws when API returns empty prompt', async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: '' });
    await expect(
      learnFromTransactions({ bankPrompt: 'old', transactions: [], apiKey: 'sk' })
    ).rejects.toThrow('empty prompt');
    expect(mockResponsesCreate).toHaveBeenCalled();
  });
});

describe('prepareLearningTransactions', () => {
  it('uses category ids and types correctly', () => {
    const txns: LearnTxn[] = [
      {
        id: '1',
        description: 'd',
        amount: 1,
        shared: false,
        senderId: 'bank',
        recipientId: 'cat1',
        senderLabel: 'Bank',
        recipientLabel: 'Food',
      },
      {
        id: '2',
        description: 'e',
        amount: 2,
        shared: true,
        senderId: 'cat2',
        recipientId: 'bank',
        senderLabel: 'Salary',
        recipientLabel: 'Bank',
      },
    ];
    const selected = new Set(['1', '2']);
    const list = prepareLearningTransactions('bank', txns, selected);
    expect(list).toEqual([
      { description: 'd', amount: 1, shared: false, category: 'cat1', type: 'debit' },
      { description: 'e', amount: 2, shared: true, category: 'cat2', type: 'credit' },
    ]);
  });
});

