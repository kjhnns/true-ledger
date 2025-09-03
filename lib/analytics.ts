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
  const rows: any[] = await db.getAllAsync('SELECT * FROM transactions');
  const categories = await listEntities('expense');
  const catMap = buildParentMap(categories);
  const totals = new Map<string, ExpenseSummary>();

  for (const t of rows) {
    if (t.created_at < start || t.created_at > end) continue;
    if (!t.recipient_id) continue;
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
}

async function sumByIds(
  column: 'sender_id' | 'recipient_id',
  ids: string[],
  start: number,
  end: number
): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const rows: any[] = await db.getAllAsync('SELECT * FROM transactions');
  return rows
    .filter(
      (r) =>
        r.created_at >= start &&
        r.created_at <= end &&
        r[column] &&
        ids.includes(String(r[column])) &&
        r.reviewed_at
    )
    .reduce((sum, r) => sum + r.amount, 0);
}

async function sumSavings(start: number, end: number, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const rows: any[] = await db.getAllAsync('SELECT * FROM transactions');
  let total = 0;
  for (const r of rows) {
    if (r.created_at < start || r.created_at > end) continue;
    if (!r.reviewed_at) continue;
    if (r.recipient_id && ids.includes(String(r.recipient_id))) total += r.amount;
    if (r.sender_id && ids.includes(String(r.sender_id))) total -= r.amount;
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
  const [income, expenses, savings] = await Promise.all([
    sumByIds('sender_id', incomeIds, start, end),
    sumByIds('recipient_id', expenseIds, start, end),
    sumSavings(start, end, savingsIds),
  ]);
  const savingsRatio = income === 0 ? 0 : savings / income;
  return { income, expenses, savings, cashflow: income - expenses, savingsRatio };
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

