import { getDb } from '@/lib/db';

export type IngestionStatus =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'done'
  | 'failed';

export interface IngestionJob {
  id: string;
  status: IngestionStatus;
  accountId: string;
  accountLabel: string;
  fileName: string;
  fileUri: string;
  fileSize: number;
  openaiFileId?: string;
  model?: string;
  rawResponseText?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export async function createJob(
  input: Omit<IngestionJob, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IngestionJob> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO ingestion_jobs (id,status,account_id,account_label,file_name,file_uri,file_size,openai_file_id,model,raw_response_text,created_at,updated_at,error)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.status,
    input.accountId,
    input.accountLabel,
    input.fileName,
    input.fileUri,
    input.fileSize,
    input.openaiFileId ?? null,
    input.model ?? null,
    input.rawResponseText ?? null,
    now,
    now,
    input.error ?? null
  );
  return { ...input, id, createdAt: now, updatedAt: now };
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<IngestionJob, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<IngestionJob> {
  const existing = await getJob(id);
  if (!existing) throw new Error('Job not found');
  const db = await getDb();
  const now = Date.now();
  const merged = { ...existing, ...updates, updatedAt: now };
  await db.runAsync(
    `UPDATE ingestion_jobs SET status=?, account_id=?, account_label=?, file_name=?, file_uri=?, file_size=?, openai_file_id=?, model=?, raw_response_text=?, updated_at=?, error=? WHERE id=?`,
    merged.status,
    merged.accountId,
    merged.accountLabel,
    merged.fileName,
    merged.fileUri,
    merged.fileSize,
    merged.openaiFileId ?? null,
    merged.model ?? null,
    merged.rawResponseText ?? null,
    merged.updatedAt,
    merged.error ?? null,
    id
  );
  return merged;
}

export async function getJob(id: string): Promise<IngestionJob | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM ingestion_jobs WHERE id=?',
    id
  );
  if (!row) return null;
  return mapRow(row);
}

export async function listJobs(): Promise<IngestionJob[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM ingestion_jobs ORDER BY created_at DESC'
  );
  return rows.map(mapRow);
}

function mapRow(row: any): IngestionJob {
  return {
    id: row.id,
    status: row.status,
    accountId: row.account_id,
    accountLabel: row.account_label,
    fileName: row.file_name,
    fileUri: row.file_uri,
    fileSize: row.file_size,
    openaiFileId: row.openai_file_id ?? undefined,
    model: row.model ?? undefined,
    rawResponseText: row.raw_response_text ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error ?? undefined,
  };
}
