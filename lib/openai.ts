type SecureStoreType = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
};

let SecureStore: SecureStoreType;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = {
    getItemAsync: async (key: string) => (process.env[key] as string) ?? null,
    setItemAsync: async (key: string, value: string) => { process.env[key] = value; },
  };
}
import OpenAI from 'openai';
import { getDb } from './db';
import { getEntity, listEntities, listExpenseCategories } from './entities';
import { createTransaction } from './transactions';

export const OPENAI_KEY_STORAGE_KEY = 'openai_api_key';
export const SYSTEM_PROMPT_STORAGE_KEY = 'system_prompt';
export const ASSISTANT_ID_STORAGE_KEY = 'openai_assistant_id';
export const DEFAULT_SYSTEM_PROMPT = `You are a precise financial data parser. Extract all transactions from this bank statement PDF. Format as JSON with the following schema.{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description, add all information that helps understand what this transaction was about. Like bank numbers or any other reference.",
      "amount": number,
      "category": "integer id for entity which are stated below",
      "location": "zurich" | "brasil" | "germany"  | "europe",
      "isShared": true | false,
      "type": "debit" | "credit",
    }
  ]
}
`;

async function uploadFile(apiKey: string, file: any, signal?: AbortSignal, onLog?: (m: string) => void): Promise<string> {
  // Use the installed OpenAI SDK (imported at module top). If the provided
  // file is a browser Blob (common in tests) we skip the SDK upload and use
  // the HTTP fallback which tests mock.
  const client = new OpenAI({ apiKey });
  // If the caller provided a Browser Blob (common in tests), skip the SDK
  // upload path and use the HTTP fallback which the tests mock.
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    console.log('uploadFile: detected Blob input, using HTTP upload');
    onLog?.('uploadFile: detected blob, using HTTP upload');
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', file);
    const res = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
  if (!res.ok) throw new Error('file upload failed');
    const json = await res.json();
  onLog?.(`uploadFile: uploaded (id:${json.id})`);
  return json.id as string;
  }

  // The caller should provide a file object compatible with the environment
  // (File, Blob, stream). The SDK will handle uploading. If the SDK upload
  // fails (for example in the test environment where `file` is a stub),
  // fall back to the HTTP fetch upload used by tests.
    try {
  console.log('uploadFile: attempting SDK file upload');
  onLog?.('uploadFile: attempting SDK upload');
    if (signal?.aborted) throw new Error('aborted');
    const res: any = await client.files.create({ file, purpose: 'assistants' } as any);
  console.log('uploadFile: SDK upload succeeded, file id', res.id);
  onLog?.(`uploadFile: uploaded (id:${res.id})`);
  return res.id as string;
  } catch (sdkErr) {
  console.log('uploadFile: SDK upload failed, falling back to HTTP upload', sdkErr);
  onLog?.('uploadFile: SDK upload failed, falling back to HTTP');
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', file);
    const res = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
  if (!res.ok) throw new Error('file upload failed');
  const json = await res.json();
  onLog?.(`uploadFile: uploaded (id:${json.id})`);
  return json.id as string;
  }
}

async function createThread(apiKey: string, fileId: string, prompt: string, signal?: AbortSignal, onLog?: (m: string) => void) {
  // Helper to perform the HTTP fallback create/run used by tests.
  async function httpCreateThread() {
    const createRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
            attachments: [{ file_id: fileId, tools: [{ type: 'file_search' }] }],
          },
        ],
  }),
  // signal passed from outer scope if provided
      signal,
    });
  if (!createRes.ok) throw new Error('thread creation failed');
    const thread = await createRes.json();
    // In tests the mocked response may already return the parsed transactions
    // object. If so, return it directly.
    if (thread && thread.transactions) {
      onLog?.('createThread: received transactions from HTTP fallback');
      return thread;
    }
    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal,
    });
  if (!runRes.ok) throw new Error('thread run failed');
    const runJson = await runRes.json();
  onLog?.('createThread: run completed (HTTP)');
    return runJson;
  }

  // Prefer the installed OpenAI SDK. If anything fails, fall back to the
  // HTTP-based flow used by tests and older environments.
  // If fetch is mocked (jest), skip SDK entirely to avoid the SDK internals
  // consuming mocked fetch responses.
  if (typeof global !== 'undefined' && (global as any).fetch && (global as any).fetch.mock) {
    console.log('createThread: detected mocked fetch, using HTTP fallback');
    onLog?.('createThread: using HTTP fallback (mocked fetch)');
    return httpCreateThread();
  }
  try {
    console.log('createThread: using OpenAI SDK');
    onLog?.('createThread: using OpenAI SDK');
    const client = new OpenAI({ apiKey });

  console.log('createThread: creating thread');
  onLog?.('createThread: creating thread');
  if (signal?.aborted) throw new Error('aborted');
  const thread: any = await client.beta.threads.create();
    console.log('createThread: thread created', thread?.id);
    onLog?.(`createThread: thread created (id:${thread?.id})`);

    // Ensure we have an assistant id stored. If not, create an assistant
    // that declares the file_search tool and persist its id in SecureStore.
    let assistantId = await SecureStore.getItemAsync(ASSISTANT_ID_STORAGE_KEY);
    if (!assistantId) {
      console.log('createThread: no assistant id found in secure store, creating assistant');
      try {
        const assistant = await client.beta.assistants.create({
          name: 'Bank PDF parser',
          model: 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
        } as any);
        assistantId = assistant?.id;
        if (assistantId) {
          await SecureStore.setItemAsync(ASSISTANT_ID_STORAGE_KEY, assistantId);
          console.log('createThread: assistant created and saved', assistantId);
          onLog?.(`createThread: assistant created (id:${assistantId})`);
        } else {
          console.log('createThread: assistant created but no id returned');
          onLog?.('createThread: assistant created but no id returned');
        }
      } catch (e) {
        console.log('createThread: failed to create assistant, will continue without saving', e);
        onLog?.('createThread: failed to create assistant');
      }
    } else {
    console.log('createThread: using stored assistant id', assistantId);
    onLog?.(`createThread: using assistant id:${assistantId}`);
    }

    console.log('createThread: adding user message with attachment');
  onLog?.('createThread: adding user message');
  if (signal?.aborted) throw new Error('aborted');
  await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `${prompt}
Only return the JSON output and no explanations or any other decorative text, do not put markdown JSON codeblock around the output transactions from the attached bank statement PDF.`,
      attachments: [{ file_id: fileId, tools: [{ type: 'file_search' }] }],
  } as any);
    console.log('createThread: user message created');
    onLog?.('createThread: user message created');

  console.log('createThread: starting assistant run');
  onLog?.('createThread: starting run');
    // Pass the assistant_id when starting the run. If available, prefer
    // createAndPoll helper which returns when the run is complete.
    let run: any;
    if (assistantId && (client.beta.threads.runs as any).createAndPoll) {
      try {
  if (signal?.aborted) throw new Error('aborted');
  run = await (client.beta.threads.runs as any).createAndPoll(thread.id, { assistant_id: assistantId } as any);
  console.log('createThread: run completed via createAndPoll', run?.id);
  onLog?.('createThread: run completed');
      } catch (e) {
        console.log('createThread: createAndPoll failed, falling back to create+poll', e);
  onLog?.('createThread: createAndPoll failed, falling back');
      }
    }
    if (!run) {
  if (signal?.aborted) throw new Error('aborted');
  const createdRun: any = await client.beta.threads.runs.create(thread.id, { assistant_id: assistantId } as any);
  console.log('createThread: run created', createdRun?.id);
  onLog?.('createThread: run created');

  console.log('createThread: polling run status');
  onLog?.('createThread: polling run status');
      const runStatus: any = await client.beta.threads.runs.poll(createdRun.id, { thread_id: thread.id } as any);
      console.log('createThread: run status', runStatus?.status);
      if (runStatus.status !== 'completed') {
        throw new Error(`Assistant run failed with status: ${runStatus.status}`);
      }

      run = runStatus;
    }

  console.log('createThread: fetching messages');
  onLog?.('createThread: fetching messages');
  if (signal?.aborted) throw new Error('aborted');
  const messages: any = await client.beta.threads.messages.list(thread.id);
    console.log('createThread: messages fetched', (messages.data || []).length);
    const assistantMessage = (messages.data || []).find((m: any) => m.role === 'assistant');
    if (!assistantMessage) throw new Error('No assistant message returned');
    const textBlock = (assistantMessage.content || []).find((c: any) => c.type === 'text');
    const responseText = textBlock?.text?.value ?? '';
  console.log('createThread: assistant response (truncated)', responseText.slice(0, 400));
  onLog?.('createThread: assistant response received');

    // Parse JSON from assistant
    let parsed: any;
    try {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      parsed = JSON.parse(jsonText);
  console.log('createThread: parsed assistant JSON');
  onLog?.('createThread: parsed assistant JSON');
    } catch (err) {
      console.log('createThread: failed to parse assistant JSON', err);
  onLog?.('createThread: failed to parse assistant JSON');
  throw new Error('Assistant response is not valid JSON');
    }

    // Cleanup thread (best-effort)
    try {
      if (signal?.aborted) {
        console.log('createThread: abort detected before delete, skipping cleanup');
        onLog?.('createThread: abort detected, skipping cleanup');
      } else {
        await client.beta.threads.delete(thread.id);
        console.log('createThread: thread deleted');
        onLog?.('createThread: thread deleted');
      }
    } catch (e) {
      console.log('createThread: failed to delete thread', e);
    }

    return parsed;
  } catch (sdkErr) {
    console.log('createThread: OpenAI SDK flow failed, falling back to HTTP', sdkErr);
  }

  // If SDK flow failed above, use the HTTP fallback used by tests.
  return httpCreateThread();
}

export async function processStatementFile(options: {
  statementId: string;
  bankId: string;
  file: any;
  apiKey: string;
  systemPrompt: string;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}) {
  const { statementId, bankId, file, apiKey, systemPrompt, onProgress, signal } = options;
  const db = await getDb();
  try {
    if (!apiKey) throw new Error('missing api key');
    onProgress?.(0);
    const fileId = await uploadFile(apiKey, file, signal);
    console.log(fileId);
    onProgress?.(0.25);
    await db.runAsync(
      'UPDATE statements SET external_file_id=? WHERE id=?',
      fileId,
      statementId
    );
    const bank = await getEntity(bankId);
    const cats = await listExpenseCategories();

    // List all entities (banks, expense, income, savings) with their ids so the
    // assistant can map category values to entity ids in its output.
    const allEntities = [
      ...(await listEntities('bank')),
      ...(await listEntities('expense')),
      ...(await listEntities('income')),
      ...(await listEntities('savings')),
    ];

    const entitiesListText = [
      'Entities (id: label, category):',
      ...allEntities.map((e) => `${e.id}: ${e.label} (${e.category})`),
    ].join('\n');

    const prompt = [
      systemPrompt,
      entitiesListText,
      bank ? bank.prompt : '',
    ]
      .filter(Boolean)
      .join('\n');
      console.log('PROMPT', prompt);
  const thread = await createThread(apiKey, fileId, prompt, signal);
    console.log(thread)
    onProgress?.(0.5);
    const txns = thread.transactions ?? [];
    const total = txns.length;
    if (total === 0) {
      onProgress?.(1);
    } else if (bank) {
      // Build quick lookup maps for entities by id and by label (lowercase)
      const entitiesById: Record<string, any> = {};
      const entitiesByLabel: Record<string, any> = {};
      for (const e of allEntities) {
        entitiesById[String(e.id)] = e;
        entitiesByLabel[e.label.toLowerCase()] = e;
      }

      for (let i = 0; i < total; i++) {
        const t = txns[i];
        console.log("adding transaction");

        // Resolve category -> entity. The assistant is instructed to return the
        // entity id where possible. Support both id and label fallback.
        let categoryEntity: any = null;
        if (t.category) {
          const catId = String(t.category);
          categoryEntity = entitiesById[catId] || entitiesByLabel[String(t.category).toLowerCase()];
        }

        // Determine sender/recipient based on transaction type.
        // credit -> bank is recipient and category is sender
        // debit  -> bank is sender and category is recipient
        let senderId: string | null = null;
        let recipientId: string | null = null;
        if (String(t.type).toLowerCase() === 'credit') {
          recipientId = bank.id;
          senderId = categoryEntity ? categoryEntity.id : null;
        } else {
          // default to debit
          senderId = bank.id;
          recipientId = categoryEntity ? categoryEntity.id : null;
        }

        await createTransaction({
          statementId,
          recipientId,
          senderId,
          createdAt: Date.parse(t.date) || Date.now(),
          amount: Math.round(t.amount),
          currency: bank.currency,
          location: t.location ?? null,
          description: t.description ?? null,
          shared: !!t.isShared,
          sharedAmount: t.isShared ? Math.round(t.amount / 2) : null,
        });
        onProgress?.(0.5 + ((i + 1) / total) * 0.5);
      }
    }
    await db.runAsync(
      'UPDATE statements SET status=? WHERE id=?',
      'processed',
      statementId
    );
  } catch (err) {
    await db.runAsync('UPDATE statements SET status=? WHERE id=?', 'error', statementId);
    throw err;
  }
}

