import { z } from 'zod';
import { getDb } from './db';

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
    result.push({
      ...stmt,
      transactionCount: countRow?.count ?? 0,
      bankLabel: bankRow?.label ?? '',
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
