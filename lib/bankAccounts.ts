import { z } from 'zod';
// import { generateClassificationKey } from './classification';
import { getDb } from './db';

export interface BankAccount {
  id: string;
  label: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export const bankAccountSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  prompt: z.string().min(1, 'Prompt is required'),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

function generateId(): string {
  const cryptoObj: any = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  if (!cryptoObj?.getRandomValues) {
    throw new Error('secure random number generation is not supported');
  }
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function mapRow(row: any): Promise<BankAccount> {
  return {
    id: row.id,
    label: row.label,
  // classificationKey: row.classification_key, // Removed
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
  console.log('Creating bank account with input:', input);
  const parsed = bankAccountSchema.parse(input);
  const db = await getDb();
  console.log('Database connection established');
  const now = Date.now();
  try {
    await db.runAsync(
      'INSERT INTO bank_accounts (label, prompt, created_at, updated_at) VALUES (?,?,?,?)',
      parsed.label,
      parsed.prompt,
      now,
      now
    );
    // Get the last inserted row
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM bank_accounts WHERE rowid = last_insert_rowid()'
    );
    console.log('Created bank account with ID:', row.id);
    return mapRow(row);
  } catch (err) {
    console.error('Error creating bank account:', err);
    throw err;
  }
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput
): Promise<BankAccount> {
  const existing = await getBankAccount(id);
  if (!existing) throw new Error('Bank account not found');
  const parsed = bankAccountSchema.parse(input);
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    'UPDATE bank_accounts SET label=?, prompt=?, updated_at=? WHERE id=?',
    parsed.label,
    parsed.prompt,
    now,
    id
  );
  return {
    id,
    label: parsed.label,
    prompt: parsed.prompt,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export async function deleteBankAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM bank_accounts WHERE id=?', id);
}
