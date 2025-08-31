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
    'INSERT INTO transactions (statement_id, recipient_id, sender_id, created_at, processed_at, archived_at, location, amount, currency, reviewed_at, shared, shared_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    parsed.statementId,
    parsed.recipientId ?? null,
    parsed.senderId ?? null,
    parsed.createdAt,
    parsed.processedAt ?? null,
    parsed.archivedAt ?? null,
    parsed.location ?? null,
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
