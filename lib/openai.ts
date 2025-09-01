import { getDb } from './db';
import { getEntity, listExpenseCategories } from './entities';

export const OPENAI_KEY_STORAGE_KEY = 'openai_api_key';
export const SYSTEM_PROMPT_STORAGE_KEY = 'system_prompt';
export const DEFAULT_SYSTEM_PROMPT = `You are a precise financial data parser. Extract all transactions from this bank statement PDF. Format as JSON with the following schema.{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description, add all information that helps understand what this transaction was about. Like bank numbers or any other reference.",
      "amount": number,
      "category": "expense category which are stated below",
      "location": "zurich" | "brasil" | "germany"  | "europe",
      "isShared": true | false,
    }
  ]
}
`;

async function uploadFile(apiKey: string, file: any): Promise<string> {
  const form = new FormData();
  form.append('purpose', 'assistants');
  form.append('file', file);
  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error('file upload failed');
  }
  const json = await res.json();
  return json.id as string;
}

async function createThread(apiKey: string, fileId: string, prompt: string) {
  const res = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
          attachments: [
            { file_id: fileId, tools: [{ type: 'file_search' }] },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error('thread creation failed');
  }
  await res.json();
}

export async function processStatementFile(options: {
  statementId: string;
  bankId: string;
  file: any;
  apiKey: string;
  systemPrompt: string;
}) {
  const { statementId, bankId, file, apiKey, systemPrompt } = options;
  const db = await getDb();
  try {
    if (!apiKey) throw new Error('missing api key');
    const fileId = await uploadFile(apiKey, file);
    await db.runAsync(
      'UPDATE statements SET external_file_id=? WHERE id=?',
      fileId,
      statementId
    );
    const bank = await getEntity(bankId);
    const cats = await listExpenseCategories();
    const prompt = [
      systemPrompt,
      bank ? bank.prompt : '',
      'Expense categories: ' + cats.map((c) => c.label).join(', '),
    ]
      .filter(Boolean)
      .join('\n');
    await createThread(apiKey, fileId, prompt);
    await db.runAsync('UPDATE statements SET status=? WHERE id=?', 'processed', statementId);
  } catch (err) {
    await db.runAsync('UPDATE statements SET status=? WHERE id=?', 'error', statementId);
    throw err;
  }
}

