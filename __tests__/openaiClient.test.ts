jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve('key')),
}));

import { uploadPdfAsync, requestParseAsync } from '../src/features/upload/openaiClient';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // @ts-ignore
  global.fetch = fetchMock;
});

test('uploadPdfAsync uploads file', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file123' }) });
  const res = await uploadPdfAsync({ fileUri: 'uri', fileName: 'name.pdf' });
  expect(res.fileId).toBe('file123');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.openai.com/v1/files',
    expect.objectContaining({ method: 'POST' })
  );
});

test('requestParseAsync posts body', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ content: [{ text: '{"a":1}' }] }] }) });
  const res = await requestParseAsync({
    fileId: 'file123',
    account: { id: 'a1', label: 'Checking', parsingPrompt: 'p' },
    fileName: 'name.pdf',
  });
  expect(res.rawResponseText).toBe('{"a":1}');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.openai.com/v1/responses',
    expect.objectContaining({ method: 'POST' })
  );
});

test('requestParseAsync throws on error', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, text: async () => 'bad' });
  await expect(
    requestParseAsync({
      fileId: 'file123',
      account: { id: 'a1', label: 'Checking', parsingPrompt: 'p' },
      fileName: 'name.pdf',
    })
  ).rejects.toThrow('bad');
});
