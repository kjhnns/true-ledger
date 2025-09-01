jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

import { learnFromTransactions } from '../lib/openai';

describe('learnFromTransactions', () => {
  beforeEach(() => {
    // @ts-ignore
    require('expo-sqlite').__reset();
  });

  it('returns updated prompt', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: 'new prompt' }) });
    // @ts-ignore
    global.fetch = fakeFetch;
    const res = await learnFromTransactions({
      bankPrompt: 'old',
      transactions: [
        { description: 'd', amount: 1, shared: false, category: 'Food', type: 'debit' },
      ],
      apiKey: 'sk',
    });
    expect(res).toBe('new prompt');
    expect(fakeFetch).toHaveBeenCalled();
  });

  it('throws on error response', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    // @ts-ignore
    global.fetch = fakeFetch;
    await expect(
      learnFromTransactions({ bankPrompt: '', transactions: [], apiKey: 'sk' })
    ).rejects.toThrow();
  });

  it('throws when API returns empty prompt', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: '' }) });
    // @ts-ignore
    global.fetch = fakeFetch;
    await expect(
      learnFromTransactions({ bankPrompt: 'old', transactions: [], apiKey: 'sk' })
    ).rejects.toThrow('empty prompt');
  });
});

