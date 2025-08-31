const tables = {
  entities: [] as any[],
  statements: [] as any[],
  transactions: [] as any[],
};

let counters = { entities: 1, statements: 1, transactions: 1 };

function reset() {
  tables.entities.length = 0;
  tables.statements.length = 0;
  tables.transactions.length = 0;
  counters = { entities: 1, statements: 1, transactions: 1 };
}

export const sqliteMock = {
  __reset: reset,
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    getAllAsync: async (sql: string, param?: any) => {
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
      return [];
    },
    getFirstAsync: async (sql: string, param?: any) => {
      if (sql.startsWith('SELECT COUNT(*) as count FROM entities')) {
        return {
          count: tables.entities.filter((r) => r.category === param).length,
        };
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
      } else if (sql.startsWith('UPDATE statements SET status=')) {
        const [status, reviewed_at, id] = params;
        const row = tables.statements.find((r) => r.id === id);
        if (row) {
          row.status = status;
          row.reviewed_at = reviewed_at;
        }
      }
    },
  }),
};

export default sqliteMock;
