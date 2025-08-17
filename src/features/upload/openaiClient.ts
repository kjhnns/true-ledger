import * as SecureStore from 'expo-secure-store';
import { DEFAULT_MODEL, UPLOAD_TIMEOUT_MS, PARSE_TIMEOUT_MS } from './constants';

async function getApiKey(): Promise<string> {
  const key = await SecureStore.getItemAsync('openai_api_key');
  if (!key) throw new Error('API key not set');
  return key;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function uploadPdfAsync({
  fileUri,
  fileName,
}: {
  fileUri: string;
  fileName: string;
}): Promise<{ fileId: string }> {
  const apiKey = await getApiKey();
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: fileName,
    type: 'application/pdf',
  } as any);
  form.append('purpose', 'assistants');
  const res = await withTimeout(
    fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    }),
    UPLOAD_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { fileId: json.id };
}

export async function requestParseAsync({
  fileId,
  account,
  fileName,
  model = DEFAULT_MODEL,
}: {
  fileId: string;
  account: { id: string; label: string; classificationKey?: string; parsingPrompt: string };
  fileName: string;
  model?: string;
}): Promise<{ rawResponseText: string }> {
  const apiKey = await getApiKey();
  const body = {
    model,
    input: [
      { role: 'system', content: 'You are a bank statement parser. Return JSON with normalized transactions.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Parse this statement. Bank account classification key and instructions below.' },
          {
            type: 'text',
            text: `ACCOUNT_LABEL: ${account.label}\nCLASSIFICATION_KEY: ${account.classificationKey ?? ''}\nINSTRUCTIONS: ${account.parsingPrompt}`,
          },
          { type: 'input_file', file_id: fileId },
        ],
      },
    ],
    metadata: {
      source: 'mobile',
      account_id: account.id,
      filename: fileName,
    },
    max_output_tokens: 200000,
  };
  const res = await withTimeout(
    fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    PARSE_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const rawResponseText = json.output?.[0]?.content?.[0]?.text ?? '';
  return { rawResponseText };
}
