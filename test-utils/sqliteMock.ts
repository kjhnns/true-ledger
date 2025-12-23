const tables = {
  entities: [] as any[],
  statements: [] as any[],
  transactions: [] as any[],
};

let counters = { entities: 1, statements: 1, transactions: 1 };
let closeCount = 0;

function reset() {
  tables.entities.length = 0;
  tables.statements.length = 0;
  tables.transactions.length = 0;
  counters = { entities: 1, statements: 1, transactions: 1 };
  closeCount = 0;
}

export const sqliteMock = {
  __reset: reset,
  __getCloseCount: () => closeCount,
  defaultDatabaseDirectory: 'file:///mock/SQLite',
  async deleteDatabaseAsync() {
    reset();
  },
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    getAllAsync: async (sql: string, ...params: any[]) => {
      const param = params[0];
      if (sql.startsWith('SELECT * FROM entities')) {
        return tables.entities.filter((r) => r.category === param);
      }
      if (sql.startsWith('SELECT * FROM statements')) {
        return [...tables.statements].sort((a, b) => b.upload_date - a.upload_date);
      }
      if (sql.startsWith('SELECT * FROM transactions WHERE statement_id=?')) {
        return tables.transactions
          .filter((t) => t.statement_id === param)
          .sort((a, b) => b.created_at - a.created_at);
      }
      // Handle summarizeReviewedTransactionsByBank JOIN query (must be before general transactions query)
      if (sql.includes('FROM transactions t') && sql.includes('JOIN statements s') && sql.includes('JOIN entities e')) {
        const [start, end] = params;
        const result: any[] = [];
        const bankTotals = new Map<string, { bank_id: string; bank_label: string; count: number; total: number }>();

        for (const t of tables.transactions) {
          if (t.created_at < start || t.created_at > end || t.reviewed_at == null) continue;
          const stmt = tables.statements.find((s) => s.id === t.statement_id);
          if (!stmt) continue;
          const bank = tables.entities.find((e) => e.id === stmt.bank_id);
          if (!bank) continue;

          const existing = bankTotals.get(stmt.bank_id) || {
            bank_id: stmt.bank_id,
            bank_label: bank.label,
            count: 0,
            total: 0
          };
          existing.count += 1;
          existing.total += t.amount;
          bankTotals.set(stmt.bank_id, existing);
        }

        return Array.from(bankTotals.values()).sort((a, b) => a.bank_label.localeCompare(b.bank_label));
      }
      // Handle shared transactions query for sumSplitCredit
      if (sql.includes('FROM transactions') && sql.includes('shared = 1') && sql.includes('reviewed_at IS NOT NULL')) {
        const [start, end] = params;
        return tables.transactions
          .filter((t) =>
            t.created_at >= start &&
            t.created_at <= end &&
            t.reviewed_at != null &&
            t.shared === 1
          );
      }
      // Handle analytics queries with date range and reviewed_at filter
      if (sql.includes('FROM transactions') && sql.includes('created_at >=') && sql.includes('reviewed_at IS NOT NULL')) {
        const [start, end] = params;
        return tables.transactions
          .filter((t) =>
            t.created_at >= start &&
            t.created_at <= end &&
            t.reviewed_at != null
          )
          .sort((a, b) => a.created_at - b.created_at);
      }
      if (sql.startsWith('SELECT * FROM transactions')) {
        return [...tables.transactions].sort(
          (a, b) => b.created_at - a.created_at
        );
      }
      return [];
    },
    getFirstAsync: async (sql: string, ...params: any[]) => {
      const param = params[0];
      if (sql.startsWith('SELECT COUNT(*) as count FROM entities')) {
        return {
          count: tables.entities.filter((r) => r.category === param).length,
        };
      }
      // Handle sumByIds and sumSavings queries
      if (sql.includes('SELECT COALESCE(SUM(amount), 0) as total') && sql.includes('FROM transactions')) {
        const [start, end, ...ids] = params;
        const isSenderQuery = sql.includes('sender_id IN');
        const isRecipientQuery = sql.includes('recipient_id IN');
        const filtered = tables.transactions.filter((t) => {
          if (t.created_at < start || t.created_at > end) return false;
          if (t.reviewed_at == null) return false;
          if (isSenderQuery && !ids.includes(t.sender_id)) return false;
          if (isRecipientQuery && !ids.includes(t.recipient_id)) return false;
          return true;
        });
        const total = filtered.reduce((sum, t) => sum + t.amount, 0);
        return { total };
      }
      if (sql.startsWith('SELECT COUNT(*) as count FROM transactions')) {
        if (sql.includes('reviewed_at IS NULL')) {
          return {
            count: tables.transactions.filter(
              (t) => t.statement_id === param && !t.reviewed_at
            ).length,
          };
        }
        return {
          count: tables.transactions.filter((t) => t.statement_id === param).length,
        };
      }
      if (
        sql.startsWith(
          'SELECT MIN(created_at) as min, MAX(created_at) as max FROM transactions'
        )
      ) {
        const list = tables.transactions.filter((t) => t.statement_id === param);
        if (list.length === 0) return { min: null, max: null };
        const times = list.map((t) => t.created_at);
        return { min: Math.min(...times), max: Math.max(...times) };
      }
      if (sql.includes('rowid = last_insert_rowid()')) {
        const table = sql.includes('FROM entities')
          ? tables.entities
          : sql.includes('FROM statements')
          ? tables.statements
          : tables.transactions;
        return table[table.length - 1] ?? null;
      }
      if (sql.startsWith('SELECT * FROM entities WHERE id=?')) {
        return tables.entities.find((r) => r.id === param) ?? null;
      }
      if (sql.startsWith('SELECT label FROM entities WHERE id=?')) {
        const row = tables.entities.find((r) => r.id === param);
        return row ? { label: row.label } : null;
      }
      if (sql.startsWith('SELECT * FROM statements WHERE id=?')) {
        return tables.statements.find((r) => r.id === param) ?? null;
      }
      if (sql.startsWith('SELECT * FROM transactions WHERE id=?')) {
       return tables.transactions.find((r) => r.id === param) ?? null;
      }
      return null;
    },
    runAsync: async (sql: string, ...params: any[]) => {
      if (sql.startsWith('INSERT INTO entities')) {
        const [label, category, prompt, parent_id, currency, created_at, updated_at] = params;
        tables.entities.push({
          id: String(counters.entities++),
          label,
          category,
          prompt,
          parent_id,
          currency,
          created_at,
          updated_at,
        });
      } else if (sql.startsWith('UPDATE entities')) {
        const [label, category, prompt, parent_id, currency, updated_at, id] = params;
        const row = tables.entities.find((r) => r.id === id);
        if (row) {
          row.label = label;
          row.category = category;
          row.prompt = prompt;
          row.parent_id = parent_id;
          row.currency = currency;
          row.updated_at = updated_at;
        }
      } else if (sql.startsWith('DELETE FROM entities')) {
        const [id] = params;
        const idx = tables.entities.findIndex((r) => r.id === id);
        if (idx !== -1) tables.entities.splice(idx, 1);
      } else if (sql.startsWith('INSERT INTO statements')) {
        const [bank_id, upload_date, file, external_file_id, status] = params;
        tables.statements.push({
          id: String(counters.statements++),
          bank_id,
          upload_date,
          file,
          external_file_id,
          status,
          processed_at: null,
          reviewed_at: null,
          published_at: null,
          archived_at: null,
        });
      } else if (sql.startsWith('INSERT INTO transactions')) {
        const [statement_id, recipient_id, sender_id, created_at, processed_at, archived_at, location, description, amount, currency, reviewed_at, shared, shared_amount] = params;
        tables.transactions.push({
          id: String(counters.transactions++),
          statement_id,
          recipient_id,
          sender_id,
          created_at,
          processed_at,
          archived_at,
          location,
          description,
          amount,
          currency,
          reviewed_at,
          shared,
          shared_amount,
        });
      } else if (sql.startsWith('UPDATE transactions')) {
        const id = params[params.length - 1];
        const row = tables.transactions.find((r) => r.id === id);
        if (row) {
          const cols = sql
            .slice('UPDATE transactions SET '.length, sql.indexOf(' WHERE'))
            .split(',')
            .map((s) => s.trim().split('=')[0]);
          cols.forEach((col, idx) => {
            const value = params[idx];
            if (col === 'recipient_id') row.recipient_id = value;
            if (col === 'sender_id') row.sender_id = value;
            if (col === 'shared') row.shared = value;
            if (col === 'shared_amount') row.shared_amount = value;
            if (col === 'description') row.description = value;
            if (col === 'reviewed_at') row.reviewed_at = value;
          });
        }
      } else if (sql.startsWith('UPDATE statements SET external_file_id=')) {
        const [external_file_id, id] = params;
        const row = tables.statements.find((r) => r.id === id);
        if (row) {
          row.external_file_id = external_file_id;
        }
      } else if (sql.startsWith('UPDATE statements SET status=')) {
        if (sql.includes('reviewed_at')) {
          const [status, reviewed_at, id] = params;
          const row = tables.statements.find((r) => r.id === id);
          if (row) {
            row.status = status;
            row.reviewed_at = reviewed_at;
          }
        } else if (sql.includes('processed_at')) {
          const [status, processed_at, id] = params;
          const row = tables.statements.find((r) => r.id === id);
          if (row) {
            row.status = status;
            row.processed_at = processed_at;
          }
        } else {
          const [status, id] = params;
          const row = tables.statements.find((r) => r.id === id);
          if (row) {
            row.status = status;
          }
        }
      }
    },
    closeAsync: async () => {
      closeCount += 1;
    },
  }),
};

export default sqliteMock;
