import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';
import { getDb } from './db';

export interface BankAccount {
  id: string;
  label: string;
  classificationKey?: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export const bankAccountSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  classificationKey: z.string().min(1).optional(),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

function secureKey(id: string) {
  return `bank_account:${id}:classificationKey`;
}

async function mapRow(row: any): Promise<BankAccount> {
  let classificationKey: string | null = row.classification_key;
  if (!classificationKey) {
    try {
      classificationKey = await SecureStore.getItemAsync(secureKey(row.id));
    } catch {
      classificationKey = null;
    }
  }
  return {
    id: row.id,
    label: row.label,
    classificationKey: classificationKey ?? undefined,
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
  const id = crypto.randomUUID();
  const now = Date.now();
  let classificationColumn: string | null = null;
  if (parsed.classificationKey) {
    try {
      await SecureStore.setItemAsync(secureKey(id), parsed.classificationKey);
    } catch {
      classificationColumn = parsed.classificationKey;
    }
  }
  await db.runAsync(
    'INSERT INTO bank_accounts (id,label,classification_key,prompt,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    id,
    parsed.label,
    classificationColumn,
    parsed.prompt,
    now,
    now
  );
  return {
    id,
    label: parsed.label,
    classificationKey: parsed.classificationKey,
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
  const now = Date.now();
  let classificationColumn: string | null = null;
  let classificationKey = existing.classificationKey;
  if (parsed.classificationKey) {
    try {
      await SecureStore.setItemAsync(secureKey(id), parsed.classificationKey);
      classificationKey = parsed.classificationKey;
    } catch {
      classificationColumn = parsed.classificationKey;
      classificationKey = parsed.classificationKey;
    }
  }
  await db.runAsync(
    'UPDATE bank_accounts SET label=?, classification_key=?, prompt=?, updated_at=? WHERE id=?',
    parsed.label,
    classificationColumn,
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
  try {
    await SecureStore.deleteItemAsync(secureKey(id));
  } catch {
    // ignore
  }
}
