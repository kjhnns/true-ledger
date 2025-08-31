import { z } from 'zod';
import { getDb } from './db';
import { Currency, SUPPORTED_CURRENCIES } from './currencies';

export interface Transaction {
  id: string;
  statementId: string;
  recipientId: string | null;
  senderId: string | null;
  createdAt: number;
  processedAt: number | null;
  archivedAt: number | null;
  location: string | null;
  description: string | null;
  amount: number;
  currency: Currency;
  reviewedAt: number | null;
  shared: boolean;
  sharedAmount: number | null;
}

export const transactionSchema = z.object({
  statementId: z.string(),
  recipientId: z.string().nullable().optional(),
  senderId: z.string().nullable().optional(),
  createdAt: z.number().int(),
  processedAt: z.number().int().nullable().optional(),
  archivedAt: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.number().int().nonnegative(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  reviewedAt: z.number().int().nullable().optional(),
  shared: z.boolean().default(false),
  sharedAmount: z.number().nullable().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

function mapRow(row: any): Transaction {
  return {
    id: String(row.id),
    statementId: String(row.statement_id),
    recipientId: row.recipient_id ? String(row.recipient_id) : null,
    senderId: row.sender_id ? String(row.sender_id) : null,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? null,
    archivedAt: row.archived_at ?? null,
    location: row.location ?? null,
    description: row.description ?? null,
    amount: row.amount,
    currency: row.currency as Currency,
    reviewedAt: row.reviewed_at ?? null,
    shared: !!row.shared,
    sharedAmount: row.shared_amount ?? null,
  };
}

export async function createTransaction(
  input: TransactionInput
): Promise<Transaction> {
  const parsed = transactionSchema.parse(input);
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO transactions (statement_id, recipient_id, sender_id, created_at, processed_at, archived_at, location, description, amount, currency, reviewed_at, shared, shared_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    parsed.statementId,
    parsed.recipientId ?? null,
    parsed.senderId ?? null,
    parsed.createdAt,
    parsed.processedAt ?? null,
    parsed.archivedAt ?? null,
    parsed.location ?? null,
    parsed.description ?? null,
    parsed.amount,
    parsed.currency,
    parsed.reviewedAt ?? null,
    parsed.shared ? 1 : 0,
    parsed.sharedAmount ?? null
  );
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM transactions WHERE rowid = last_insert_rowid()'
  );
  return mapRow(row);
}

export async function listTransactions(
  statementId: string
): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions WHERE statement_id=? ORDER BY created_at DESC',
    statementId
  );
  return rows.map(mapRow);
}

export type TransactionUpdateInput = Partial<
  Pick<
    TransactionInput,
    'recipientId' | 'senderId' | 'shared' | 'sharedAmount' | 'description' | 'reviewedAt'
  >
>;

export async function updateTransaction(
  id: string,
  input: TransactionUpdateInput
): Promise<Transaction> {
  const db = await getDb();
  const existing = await db.getFirstAsync<any>(
    'SELECT * FROM transactions WHERE id=?',
    id
  );
  if (!existing) throw new Error('Transaction not found');

  const updates: string[] = [];
  const params: any[] = [];
  if (input.recipientId !== undefined) {
    updates.push('recipient_id=?');
    params.push(input.recipientId ?? null);
  }
  if (input.senderId !== undefined) {
    updates.push('sender_id=?');
    params.push(input.senderId ?? null);
  }
  if (input.shared !== undefined) {
    updates.push('shared=?');
    params.push(input.shared ? 1 : 0);
  }
  if (input.sharedAmount !== undefined) {
    updates.push('shared_amount=?');
    params.push(input.sharedAmount ?? null);
  }
  if (input.description !== undefined) {
    updates.push('description=?');
    params.push(input.description ?? null);
  }
  if (input.reviewedAt !== undefined) {
    updates.push('reviewed_at=?');
    params.push(input.reviewedAt ?? null);
  }
  if (updates.length === 0) {
    return mapRow(existing);
  }
  params.push(id);
  await db.runAsync(
    `UPDATE transactions SET ${updates.join(', ')} WHERE id=?`,
    ...params
  );
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM transactions WHERE id=?',
    id
  );
  if (input.reviewedAt !== undefined) {
    const remaining =
      (await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM transactions WHERE statement_id=? AND reviewed_at IS NULL',
        row.statement_id
      )) ?? { count: 0 };
    await db.runAsync(
      'UPDATE statements SET status=?, reviewed_at=? WHERE id=?',
      remaining.count === 0 ? 'reviewed' : 'processed',
      remaining.count === 0 ? Date.now() : null,
      row.statement_id
    );
  }
  return mapRow(row);
}
