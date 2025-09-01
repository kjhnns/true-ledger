import { z } from 'zod';
import { getDb } from './db';
import { getEntity, listExpenseCategories } from './entities';
import { createTransaction } from './transactions';

export const STATEMENT_STATUSES = ['new', 'processed', 'reviewed', 'published'] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

export interface Statement {
  id: string;
  bankId: string;
  uploadDate: number;
  file: string | null;
  externalFileId: string | null;
  status: StatementStatus;
  processedAt: number | null;
  reviewedAt: number | null;
  publishedAt: number | null;
  archivedAt: number | null;
}

export const statementSchema = z.object({
  bankId: z.string(),
  uploadDate: z.number().int(),
  file: z.string().nullable().optional(),
  externalFileId: z.string().nullable().optional(),
  status: z.enum(STATEMENT_STATUSES).default('new'),
});

export type StatementInput = z.infer<typeof statementSchema>;

function mapRow(row: any): Statement {
  return {
    id: String(row.id),
    bankId: String(row.bank_id),
    uploadDate: row.upload_date,
    file: row.file ?? null,
    externalFileId: row.external_file_id ?? null,
    status: row.status as StatementStatus,
    processedAt: row.processed_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    publishedAt: row.published_at ?? null,
    archivedAt: row.archived_at ?? null,
  };
}

export interface StatementMeta extends Statement {
  bankLabel: string;
  transactionCount: number;
  earliest: number | null;
  latest: number | null;
}

export async function createStatement(input: StatementInput): Promise<Statement> {
  const parsed = statementSchema.parse(input);
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO statements (bank_id, upload_date, file, external_file_id, status) VALUES (?,?,?,?,?)',
    parsed.bankId,
    parsed.uploadDate,
    parsed.file ?? null,
    parsed.externalFileId ?? null,
    parsed.status
  );
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM statements WHERE rowid = last_insert_rowid()'
  );
  return mapRow(row);
}

export async function listStatementsWithMeta(): Promise<StatementMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM statements ORDER BY upload_date DESC'
  );
  const result: StatementMeta[] = [];
  for (const row of rows) {
    const stmt = mapRow(row);
    const countRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE statement_id=?',
      stmt.id
    );
    const bankRow = await db.getFirstAsync<{ label: string }>(
      'SELECT label FROM entities WHERE id=?',
      stmt.bankId
    );
    const dateRow = await db.getFirstAsync<{ min: number | null; max: number | null }>(
      'SELECT MIN(created_at) as min, MAX(created_at) as max FROM transactions WHERE statement_id=?',
      stmt.id
    );
    result.push({
      ...stmt,
      transactionCount: countRow?.count ?? 0,
      bankLabel: bankRow?.label ?? '',
      earliest: dateRow?.min ?? null,
      latest: dateRow?.max ?? null,
    });
  }
  return result;
}

export async function getStatement(id: string): Promise<Statement | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM statements WHERE id=?',
    id
  );
  if (!row) return null;
  return mapRow(row);
}

export async function archiveStatement(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE statements SET archived_at=? WHERE id=?',
    Date.now(),
    id
  );
}

export async function deleteStatement(id: string): Promise<void> {
  const db = await getDb();
  // remove transactions first
  await db.runAsync('DELETE FROM transactions WHERE statement_id=?', id);
  await db.runAsync('DELETE FROM statements WHERE id=?', id);
}

export async function reprocessStatement(id: string): Promise<void> {
  const db = await getDb();
  // reset processing/review/publish timestamps and status
  await db.runAsync(
    'UPDATE statements SET processed_at=NULL, reviewed_at=NULL, published_at=NULL, status=? WHERE id=?',
    'new',
    id
  );
}

export async function unarchiveStatement(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE statements SET archived_at=NULL WHERE id=?', id);
}

export async function createDummyStatementWithTransactions(
  bankId: string,
  fileName: string
): Promise<Statement> {
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are allowed');
  }
  const bank = await getEntity(bankId);
  if (!bank || bank.category !== 'bank') {
    throw new Error('Invalid bank');
  }
  const categories = await listExpenseCategories();
  if (categories.length === 0) {
    throw new Error('No expense categories available');
  }
  const statement = await createStatement({
    bankId,
    uploadDate: Date.now(),
    file: fileName,
    status: 'new',
  });
  for (let i = 0; i < 10; i++) {
    const recipient =
      categories[Math.floor(Math.random() * categories.length)];
    const amount = Math.floor(Math.random() * 10000) + 1;
    const shared = Math.random() < 0.5;
    try {
      let txn = await createTransaction({
        statementId: statement.id,
        recipientId: recipient.id,
        senderId: bank.id,
        createdAt: Date.now(),
        amount,
        currency: bank.currency,
        shared,
        sharedAmount: shared ? Math.floor(amount / 2) : null,
        description: null,
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  }
  return statement;
}
