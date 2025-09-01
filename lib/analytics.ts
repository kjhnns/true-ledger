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
