jest.mock('expo-sqlite', () => require('../test-utils/sqliteMock').sqliteMock);

const createResponseMock = jest.fn().mockResolvedValue({ output_text: 'new prompt' });
jest.mock('openai', () => {
  return function () {
    return { responses: { create: createResponseMock } };
  };
});

import { initDb } from '../lib/db';
import { createBankAccount, createExpenseCategory } from '../lib/entities';
import { createStatement, getStatement } from '../lib/statements';
import { listTransactions } from '../lib/transactions';
import {
  processStatementFile,
  DEFAULT_SYSTEM_PROMPT,
  learnFromTransactions,
  DEFAULT_LEARN_PROMPT,
} from '../lib/openai';
const sqlite = require('expo-sqlite');

describe('openai processing', () => {
  beforeEach(async () => {
    sqlite.__reset();
    await initDb();
  });

  test('processStatementFile reports progress and inserts transactions', async () => {
    const bank = await createBankAccount({
      label: 'Bank',
      prompt: 'bank prompt',
      currency: 'USD',
    });
    await createExpenseCategory({ label: 'Food', prompt: 'p', parentId: null });
    const stmt = await createStatement({
      bankId: bank.id,
      uploadDate: Date.now(),
      file: 'f.pdf',
      status: 'new',
    });
    const fakeFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactions: [
            { date: '2024-01-01', amount: 100, description: 'A' },
            { date: '2024-01-02', amount: 200, description: 'B', isShared: true },
          ],
        }),
      });
    // @ts-ignore
    global.fetch = fakeFetch;
    const events: number[] = [];
    await processStatementFile({
      statementId: stmt.id,
      bankId: bank.id,
      file: new Blob(['x']),
      apiKey: 'sk',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      onProgress: (p) => events.push(p),
    });
    const updated = await getStatement(stmt.id);
    expect(updated?.externalFileId).toBe('file123');
    expect(updated?.status).toBe('processed');
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    const txns = await listTransactions(stmt.id);
    expect(txns).toHaveLength(2);
    expect(events).toContain(1);
  });

  test('processStatementFile sets error on failure', async () => {
    const bank = await createBankAccount({
      label: 'Bank',
      prompt: 'p',
      currency: 'USD',
    });
    await createExpenseCategory({ label: 'Food', prompt: 'p', parentId: null });
    const stmt = await createStatement({
      bankId: bank.id,
      uploadDate: Date.now(),
      file: 'f.pdf',
      status: 'new',
    });
    const fakeFetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    // @ts-ignore
    global.fetch = fakeFetch;
    await expect(
      processStatementFile({
        statementId: stmt.id,
        bankId: bank.id,
        file: new Blob(['x']),
        apiKey: 'sk',
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      })
    ).rejects.toThrow();
    const updated = await getStatement(stmt.id);
    expect(updated?.status).toBe('error');
  });

  test('learnFromTransactions builds prompt correctly', async () => {
    createResponseMock.mockClear();
    await learnFromTransactions({
      bankPrompt: 'bank',
      basePrompt: 'base',
      transactions: [],
      apiKey: 'sk',
    });
    const input = createResponseMock.mock.calls[0][0].input;
    expect(input.startsWith('base\nbank')).toBe(true);

    createResponseMock.mockClear();
    await learnFromTransactions({
      bankPrompt: 'bank',
      transactions: [],
      apiKey: 'sk',
    });
    const input2 = createResponseMock.mock.calls[0][0].input;
    expect(input2.startsWith(`${DEFAULT_LEARN_PROMPT}\nbank`)).toBe(true);
  });

  test('learnFromTransactions logs prompt with transactions', async () => {
    const logs: string[] = [];
    await learnFromTransactions({
      bankPrompt: 'bank',
      basePrompt: 'base',
      transactions: [
        {
          description: 'd',
          amount: 1,
          shared: false,
          category: 'c',
          type: 'debit',
        },
      ],
      apiKey: 'sk',
      onLog: (m) => logs.push(m),
    });
    const expected = 'base\nbank\nTxn 1: description="d" amount=1 shared=false category="c" type=debit\n\n';
    expect(logs).toContain(expected);
  });
});

