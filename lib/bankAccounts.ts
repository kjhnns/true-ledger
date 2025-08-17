import { z } from 'zod';
import { getDb } from './db';
import { generateClassificationKey } from './classification';

export interface BankAccount {
  id: string;
  label: string;
  classificationKey: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export const bankAccountSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  prompt: z.string().min(1, 'Prompt is required'),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

async function mapRow(row: any): Promise<BankAccount> {
  return {
    id: row.id,
    label: row.label,
    classificationKey: row.classification_key,
    prompt: row.prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM bank_accounts ORDER BY created_at DESC'
  );
  const accounts: BankAccount[] = [];
  for (const row of rows) {
    accounts.push(await mapRow(row));
  }
  return accounts;
}

export async function getBankAccount(id: string): Promise<BankAccount | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM bank_accounts WHERE id=?',
    id
  );
  if (!row) return null;
  return mapRow(row);
}

export async function createBankAccount(
  input: BankAccountInput
): Promise<BankAccount> {
  const parsed = bankAccountSchema.parse(input);
  const db = await getDb();
  const existingRows = await db.getAllAsync<{ classification_key: string }>(
    'SELECT classification_key FROM bank_accounts'
  );
  const existing = new Set(existingRows.map((r) => r.classification_key));
  const id = crypto.randomUUID();
  const now = Date.now();
  const classificationKey = generateClassificationKey(parsed.label, existing);
  await db.runAsync(
    'INSERT INTO bank_accounts (id,label,classification_key,prompt,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    id,
    parsed.label,
    classificationKey,
    parsed.prompt,
    now,
    now
  );
  return {
    id,
    label: parsed.label,
    classificationKey,
    prompt: parsed.prompt,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput
): Promise<BankAccount> {
  const existing = await getBankAccount(id);
  if (!existing) throw new Error('Bank account not found');
  const parsed = bankAccountSchema.parse(input);
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; classification_key: string }>(
    'SELECT id, classification_key FROM bank_accounts WHERE id<>?',
    id
  );
  const existingKeys = new Set(rows.map((r) => r.classification_key));
  const classificationKey = generateClassificationKey(parsed.label, existingKeys);
  const now = Date.now();
  await db.runAsync(
    'UPDATE bank_accounts SET label=?, classification_key=?, prompt=?, updated_at=? WHERE id=?',
    parsed.label,
    classificationKey,
    parsed.prompt,
    now,
    id
  );
  return {
    id,
    label: parsed.label,
    classificationKey,
    prompt: parsed.prompt,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export async function deleteBankAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bank_accounts WHERE id=?', id);
}
