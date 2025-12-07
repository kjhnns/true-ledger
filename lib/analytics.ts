import { getDb } from './db';
import { listEntities, Entity } from './entities';

export interface ExpenseSummary {
  parentId: string;
  parentLabel: string;
  total: number;
}

function buildParentMap(categories: Entity[]) {
  const map = new Map<string, Entity>();
  categories.forEach((c) => map.set(c.id, c));
  return map;
}

function resolveTopParent(map: Map<string, Entity>, id: string): Entity | null {
  let current = map.get(id) || null;
  if (!current) return null;
  while (current.parentId) {
    const next = map.get(current.parentId);
    if (!next) break;
    current = next;
  }
  return current;
}

export async function summarizeExpensesByParent(start: number, end: number): Promise<ExpenseSummary[]> {
  const db = await getDb();
  // Optimize: Only fetch transactions in date range that are reviewed and have recipients
  const rows: any[] = await db.getAllAsync(
    'SELECT * FROM transactions WHERE created_at >= ? AND created_at <= ? AND reviewed_at IS NOT NULL AND recipient_id IS NOT NULL',
    start,
    end
  );
  const categories = await listEntities('expense');
  const catMap = buildParentMap(categories);
  const totals = new Map<string, ExpenseSummary>();

  for (const t of rows) {
    const parent = resolveTopParent(catMap, String(t.recipient_id));
    if (!parent) continue;
    const existing = totals.get(parent.id) || { parentId: parent.id, parentLabel: parent.label, total: 0 };
    existing.total += t.amount;
    totals.set(parent.id, existing);
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

export interface KeyMetrics {
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
  savingsRatio: number;
  splitCredit: number;
}

async function sumByIds(
  column: 'sender_id' | 'recipient_id',
  ids: string[],
  start: number,
  end: number
): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  // Optimize: Use SQL to filter and sum instead of loading all rows
  const placeholders = ids.map(() => '?').join(',');
  const query = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE created_at >= ?
      AND created_at <= ?
      AND ${column} IN (${placeholders})
      AND reviewed_at IS NOT NULL
  `;
  const row = await db.getFirstAsync<{ total: number }>(query, start, end, ...ids);
  return row?.total ?? 0;
}

async function sumSavings(start: number, end: number, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  // Optimize: Use SQL aggregation instead of loading all rows
  const placeholders = ids.map(() => '?').join(',');

  // Sum where savings account is recipient (positive)
  const recipientQuery = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE created_at >= ?
      AND created_at <= ?
      AND recipient_id IN (${placeholders})
      AND reviewed_at IS NOT NULL
  `;
  const recipientRow = await db.getFirstAsync<{ total: number }>(recipientQuery, start, end, ...ids);

  // Sum where savings account is sender (negative)
  const senderQuery = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE created_at >= ?
      AND created_at <= ?
      AND sender_id IN (${placeholders})
      AND reviewed_at IS NOT NULL
  `;
  const senderRow = await db.getFirstAsync<{ total: number }>(senderQuery, start, end, ...ids);

  return (recipientRow?.total ?? 0) - (senderRow?.total ?? 0);
}

async function sumSplitCredit(start: number, end: number): Promise<number> {
  const db = await getDb();
  // Optimize: Fetch only relevant shared transactions in date range
  const rows: any[] = await db.getAllAsync(
    'SELECT amount, shared_amount FROM transactions WHERE created_at >= ? AND created_at <= ? AND shared = 1 AND reviewed_at IS NOT NULL',
    start,
    end
  );
  let total = 0;
  for (const r of rows) {
    const sharedAmount = r.shared_amount ?? r.amount;
    total += r.amount - sharedAmount;
  }
  return total;
}

export async function computeKeyMetrics(
  start: number,
  end: number,
  incomeIds: string[],
  savingsIds: string[]
): Promise<KeyMetrics> {
  const expensesList = await listEntities('expense');
  const expenseIds = expensesList.map((e) => e.id);
  const [income, expenses, savings, splitCredit] = await Promise.all([
    sumByIds('sender_id', incomeIds, start, end),
    sumByIds('recipient_id', expenseIds, start, end),
    sumSavings(start, end, savingsIds),
    sumSplitCredit(start, end),
  ]);
  const savingsRatio = income === 0 ? 0 : savings / income;
  return {
    income,
    expenses,
    savings,
    cashflow: income - expenses,
    savingsRatio,
    splitCredit,
  };
}

export async function countReviewedTransactions(
  start: number,
  end: number
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions WHERE reviewed_at IS NOT NULL AND created_at>=? AND created_at<=?',
    start,
    end
  );
  return row?.count ?? 0;
}

export interface BankTransactionSummary {
  bankId: string;
  bankLabel: string;
  count: number;
  total: number;
}

export async function summarizeReviewedTransactionsByBank(
  start: number,
  end: number
): Promise<BankTransactionSummary[]> {
  const db = await getDb();

  // Optimize: Use SQL JOIN and aggregation instead of loading all data
  const rows = await db.getAllAsync<{
    bank_id: string;
    bank_label: string;
    count: number;
    total: number;
  }>(
    `SELECT
      s.bank_id,
      e.label as bank_label,
      COUNT(*) as count,
      COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN statements s ON t.statement_id = s.id
    JOIN entities e ON s.bank_id = e.id
    WHERE t.created_at >= ?
      AND t.created_at <= ?
      AND t.reviewed_at IS NOT NULL
    GROUP BY s.bank_id, e.label
    ORDER BY e.label`,
    start,
    end
  );

  // Get all banks to include those with zero transactions
  const banks = await listEntities('bank');
  const summary = new Map<string, BankTransactionSummary>();

  // Initialize all banks with zero
  banks.forEach((b) =>
    summary.set(b.id, { bankId: b.id, bankLabel: b.label, count: 0, total: 0 })
  );

  // Update with actual data
  rows.forEach((r) => {
    summary.set(String(r.bank_id), {
      bankId: String(r.bank_id),
      bankLabel: r.bank_label,
      count: r.count,
      total: r.total,
    });
  });

  return Array.from(summary.values()).sort((a, b) => a.bankLabel.localeCompare(b.bankLabel));
}

function toCamel(parts: string[]): string {
  return parts
    .map((part) =>
      part
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('')
    )
    .map((part, idx) =>
      idx === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part
    )
    .join('');
}

function buildEntityKey(
  entity: Entity | undefined,
  map: Map<string, Entity>
): string {
  if (!entity) return '';
  const labels: string[] = [];
  let current: Entity | undefined | null = entity;
  while (current) {
    labels.unshift(current.label);
    if (!current.parentId) break;
    current = map.get(current.parentId) || null;
  }
  const tokens = [entity.category, ...labels].map((l) => toCamel([l]));
  return tokens.join('_');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportReviewedTransactionsToCsv(
  start: number,
  end: number
): Promise<string> {
  const db = await getDb();
  // Optimize: Only fetch reviewed transactions in date range
  const rows: any[] = await db.getAllAsync(
    'SELECT * FROM transactions WHERE created_at >= ? AND created_at <= ? AND reviewed_at IS NOT NULL ORDER BY created_at',
    start,
    end
  );
  const [banks, expenses, incomes, savings] = await Promise.all([
    listEntities('bank'),
    listEntities('expense'),
    listEntities('income'),
    listEntities('savings'),
  ]);
  const entMap = new Map<string, Entity>();
  for (const e of [...banks, ...expenses, ...incomes, ...savings]) {
    entMap.set(e.id, e);
  }

  const lines = ['id,date,description,amount,sender,recipient'];
  for (const t of rows) {
    const sender = buildEntityKey(entMap.get(String(t.sender_id)), entMap);
    const recipient = buildEntityKey(entMap.get(String(t.recipient_id)), entMap);
    const cols = [
      escapeCsv(String(t.id)),
      escapeCsv(new Date(t.created_at).toISOString()),
      escapeCsv(t.description ?? ''),
      escapeCsv(String(t.amount)),
      escapeCsv(sender),
      escapeCsv(recipient),
    ];
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

