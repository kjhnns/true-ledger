jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

const mockResponsesCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
  }));
});

import { learnFromTransactions } from '../lib/openai';

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

