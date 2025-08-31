import { z } from 'zod';
import { getDb } from './db';
import { Currency, SUPPORTED_CURRENCIES } from './currencies';

export type EntityCategory = 'bank' | 'expense' | 'income' | 'savings';

export interface Entity {
  id: string;
  label: string;
  category: EntityCategory;
  prompt: string;
  parentId: string | null;
  currency: Currency;
  createdAt: number;
  updatedAt: number;
}

export type BankAccount = Entity;
export type ExpenseCategory = Entity;

export const entitySchema = z.object({
  label: z.string().min(1, 'Label is required'),
  category: z.enum(['bank', 'expense', 'income', 'savings']),
  prompt: z.string().min(1, 'Prompt is required'),
  parentId: z.string().nullable().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
});

export type EntityInput = z.infer<typeof entitySchema>;

export const bankAccountSchema = entitySchema.pick({
  label: true,
  prompt: true,
  currency: true,
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const expenseCategorySchema = entitySchema.pick({
  label: true,
  prompt: true,
  parentId: true,
});
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

function mapRow(row: any): Entity {
  return {
    id: String(row.id),
    label: row.label,
    category: row.category as EntityCategory,
    prompt: row.prompt,
    parentId: row.parent_id ? String(row.parent_id) : null,
    currency: row.currency as Currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEntities(category: EntityCategory): Promise<Entity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM entities WHERE category=? ORDER BY created_at DESC',
    category
  );
  return rows.map(mapRow);
}

export async function getEntity(id: string): Promise<Entity | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM entities WHERE id=?',
    id
  );
  if (!row) return null;
  return mapRow(row);
}

export async function createEntity(input: EntityInput): Promise<Entity> {
  const parsed = entitySchema.parse(input);
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO entities (label, category, prompt, parent_id, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
    parsed.label,
    parsed.category,
    parsed.prompt,
    parsed.parentId ?? null,
    parsed.currency,
    now,
    now
  );
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM entities WHERE rowid = last_insert_rowid()'
  );
  return mapRow(row);
}

export async function updateEntity(
  id: string,
  input: EntityInput
): Promise<Entity> {
  const existing = await getEntity(id);
  if (!existing) throw new Error('Entity not found');
  const parsed = entitySchema.parse(input);
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    'UPDATE entities SET label=?, category=?, prompt=?, parent_id=?, currency=?, updated_at=? WHERE id=?',
    parsed.label,
    parsed.category,
    parsed.prompt,
    parsed.parentId ?? null,
    parsed.currency,
    now,
    id
  );
  return {
    id,
    label: parsed.label,
    category: parsed.category,
    prompt: parsed.prompt,
    parentId: parsed.parentId ?? null,
    currency: parsed.currency,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export async function deleteEntity(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entities WHERE id=?', id);
}

export async function listBankAccounts() {
  return listEntities('bank');
}

export async function getBankAccount(id: string) {
  return getEntity(id);
}

export async function createBankAccount(input: BankAccountInput) {
  const parsed = bankAccountSchema.parse(input);
  return createEntity({ ...parsed, category: 'bank', parentId: null });
}

export async function updateBankAccount(id: string, input: BankAccountInput) {
  const parsed = bankAccountSchema.parse(input);
  return updateEntity(id, { ...parsed, category: 'bank', parentId: null });
}

export async function deleteBankAccount(id: string) {
  return deleteEntity(id);
}

export async function listExpenseCategories() {
  return listEntities('expense');
}

export async function createExpenseCategory(input: ExpenseCategoryInput) {
  const parsed = expenseCategorySchema.parse(input);
  return createEntity({
    ...parsed,
    category: 'expense',
    currency: 'USD',
  });
}

export async function updateExpenseCategory(
  id: string,
  input: ExpenseCategoryInput
) {
  const parsed = expenseCategorySchema.parse(input);
  return updateEntity(id, { ...parsed, category: 'expense', currency: 'USD' });
}

export async function deleteExpenseCategory(id: string) {
  return deleteEntity(id);
}
