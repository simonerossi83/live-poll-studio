/**
 * Local in-memory database with a Supabase-compatible API.
 *
 * - Data is persisted to localStorage so it survives page refreshes.
 * - Cross-tab "realtime" is handled via BroadcastChannel so admin and
 *   student tabs stay in sync without any server.
 * - The exported `supabase` object is a drop-in replacement for the
 *   Supabase JS client as used in this project.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

interface TableRow {
  [key: string]: unknown;
}

type SelectPart = string | { table: string; inner: string };

// ---------------------------------------------------------------------------
// Select-string parser  (handles nested joins like "students(schools(name))")
// ---------------------------------------------------------------------------

function parseSelectParts(selectStr: string): SelectPart[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of selectStr) {
    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = "";
    } else {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);

  return result.map((part) => {
    const idx = part.indexOf("(");
    if (idx > 0 && part.endsWith(")")) {
      return { table: part.slice(0, idx), inner: part.slice(idx + 1, -1) };
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "livePollLocalDb";

const INITIAL_SCHOOLS = [
  { id: crypto.randomUUID(), name: "School A", created_at: new Date().toISOString() },
  { id: crypto.randomUUID(), name: "School B", created_at: new Date().toISOString() },
  { id: crypto.randomUUID(), name: "School C", created_at: new Date().toISOString() },
  { id: crypto.randomUUID(), name: "School D", created_at: new Date().toISOString() },
  { id: crypto.randomUUID(), name: "School E", created_at: new Date().toISOString() },
];

// ---------------------------------------------------------------------------
// LocalDatabase  –  the core storage engine
// ---------------------------------------------------------------------------

class LocalDatabase {
  private data: Record<string, TableRow[]>;
  private tableListeners = new Map<string, Set<Listener>>();
  private bc: BroadcastChannel;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.data = JSON.parse(stored);
      } catch {
        this.data = this.seed();
        this.persist();
      }
    } else {
      this.data = this.seed();
      this.persist();
    }

    // Cross-tab sync via BroadcastChannel (same browsing-context group)
    this.bc = new BroadcastChannel(STORAGE_KEY);
    this.bc.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "db-change") {
        this.reloadFromStorage();
        if (e.data.table) this.fireListeners(e.data.table as string);
      }
    };

    // Fallback: the DOM `storage` event fires in other same-origin documents
    // (including some cross-context scenarios where BroadcastChannel is blocked)
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        this.reloadFromStorage();
        // We don't know which table changed, so fire all registered listeners
        for (const table of this.tableListeners.keys()) {
          this.fireListeners(table);
        }
      }
    });
  }

  // -- bootstrap --------------------------------------------------------

  private seed(): Record<string, TableRow[]> {
    return {
      schools: [...INITIAL_SCHOOLS],
      students: [],
      questions: [],
      answers: [],
    };
  }

  // -- persistence ------------------------------------------------------

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  private reloadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
      } catch {
        /* keep current data */
      }
    }
  }

  // -- listeners --------------------------------------------------------

  private fireListeners(table: string) {
    const set = this.tableListeners.get(table);
    if (set) set.forEach((fn) => { try { fn(); } catch { /* noop */ } });
  }

  private notify(table: string) {
    this.persist();
    this.fireListeners(table);
    this.bc.postMessage({ type: "db-change", table });
  }

  addListener(table: string, fn: Listener): () => void {
    if (!this.tableListeners.has(table)) {
      this.tableListeners.set(table, new Set());
    }
    this.tableListeners.get(table)!.add(fn);
    return () => {
      this.tableListeners.get(table)?.delete(fn);
    };
  }

  // -- CRUD (used by QueryBuilder) --------------------------------------

  getRows(table: string): TableRow[] {
    return this.data[table] ? [...this.data[table]] : [];
  }

  insertRows(table: string, rows: TableRow[]): TableRow[] {
    if (!this.data[table]) this.data[table] = [];
    const inserted: TableRow[] = [];

    for (const row of rows) {
      const newRow: TableRow = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row, // caller-provided values override defaults
      };

      // Table-specific defaults
      if (table === "questions") {
        if (newRow.updated_at === undefined) newRow.updated_at = new Date().toISOString();
        if (newRow.is_active === undefined) newRow.is_active = false;
        if (newRow.display_order === undefined) newRow.display_order = 0;
        if (newRow.correct_option_index === undefined) newRow.correct_option_index = 0;
        if (newRow.options === undefined) newRow.options = [];
      }

      this.data[table].push(newRow);
      inserted.push({ ...newRow });
    }

    this.notify(table);
    return inserted;
  }

  updateRows(
    table: string,
    updates: Partial<TableRow>,
    filterFn: (row: TableRow) => boolean,
  ): TableRow[] {
    if (!this.data[table]) return [];
    const updated: TableRow[] = [];

    for (let i = 0; i < this.data[table].length; i++) {
      if (filterFn(this.data[table][i])) {
        this.data[table][i] = { ...this.data[table][i], ...updates };
        if (table === "questions") {
          this.data[table][i].updated_at = new Date().toISOString();
        }
        updated.push({ ...this.data[table][i] });
      }
    }

    if (updated.length > 0) this.notify(table);
    return updated;
  }

  deleteRows(
    table: string,
    filterFn: (row: TableRow) => boolean,
  ): TableRow[] {
    if (!this.data[table]) return [];
    const deleted: TableRow[] = [];
    const remaining: TableRow[] = [];

    for (const row of this.data[table]) {
      if (filterFn(row)) deleted.push(row);
      else remaining.push(row);
    }

    this.data[table] = remaining;
    if (deleted.length > 0) this.notify(table);
    return deleted;
  }
}

// Singleton
const db = new LocalDatabase();

// ---------------------------------------------------------------------------
// QueryBuilder  –  chainable Supabase-like query API
// ---------------------------------------------------------------------------

class QueryBuilder {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Array<(row: TableRow) => boolean> = [];
  private _orderCol?: string;
  private _orderAsc = true;
  private _limit?: number;
  private _selectStr?: string;
  private _insertData?: TableRow | TableRow[];
  private _updateData?: Partial<TableRow>;
  private _single = false;
  private _maybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  // -- query methods (return `this` for chaining) -----------------------

  select(columns?: string): this {
    if (this.op === "insert") {
      // .insert(...).select("id") means "also return inserted rows"
      this._selectStr = columns || "*";
      return this;
    }
    this.op = "select";
    this._selectStr = columns || "*";
    return this;
  }

  insert(data: TableRow | TableRow[]): this {
    this.op = "insert";
    this._insertData = data;
    return this;
  }

  update(data: Partial<TableRow>): this {
    this.op = "update";
    this._updateData = data;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this._orderCol = column;
    this._orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  single(): this {
    this._single = true;
    return this;
  }

  maybeSingle(): this {
    this._maybeSingle = true;
    return this;
  }

  // -- internal helpers -------------------------------------------------

  private matchesFilter(row: TableRow): boolean {
    return this.filters.every((f) => f(row));
  }

  /**
   * Resolve a row against a select string, expanding FK joins like
   * `students(schools(name))` by navigating the local tables.
   */
  private resolveRow(row: TableRow, selectStr: string): TableRow {
    const parts = parseSelectParts(selectStr);
    const result: TableRow = {};

    for (const part of parts) {
      if (typeof part === "string") {
        if (part === "*") Object.assign(result, row);
        else result[part] = row[part];
      } else {
        // FK join — derive FK column name from the relation table name
        const singular = part.table.endsWith("s")
          ? part.table.slice(0, -1)
          : part.table;
        const fkCol = `${singular}_id`;

        if (row[fkCol]) {
          const related = db.getRows(part.table).find((r) => r.id === row[fkCol]);
          if (related) {
            result[part.table] = this.resolveRow(related, part.inner);
          } else {
            result[part.table] = null;
          }
        } else {
          result[part.table] = null;
        }
      }
    }

    return result;
  }

  // -- execution --------------------------------------------------------

  private execute(): { data: unknown; error: unknown } {
    try {
      switch (this.op) {
        // ---- INSERT ---------------------------------------------------
        case "insert": {
          const arr = Array.isArray(this._insertData)
            ? this._insertData
            : [this._insertData!];
          const inserted = db.insertRows(this.table, arr);

          if (!this._selectStr) return { data: null, error: null };

          const mapped = inserted.map((r) =>
            this.resolveRow(r, this._selectStr!),
          );

          if (this._single) return { data: mapped[0] ?? null, error: null };
          if (this._maybeSingle) return { data: mapped[0] ?? null, error: null };
          return { data: mapped, error: null };
        }

        // ---- UPDATE ---------------------------------------------------
        case "update": {
          const updated = db.updateRows(
            this.table,
            this._updateData!,
            (r) => this.matchesFilter(r),
          );
          return { data: updated, error: null };
        }

        // ---- DELETE ---------------------------------------------------
        case "delete": {
          const deleted = db.deleteRows(this.table, (r) =>
            this.matchesFilter(r),
          );
          return { data: deleted, error: null };
        }

        // ---- SELECT (default) -----------------------------------------
        default: {
          let rows = db.getRows(this.table);

          // filters
          rows = rows.filter((r) => this.matchesFilter(r));

          // ordering
          if (this._orderCol) {
            const col = this._orderCol;
            const asc = this._orderAsc;
            rows.sort((a, b) => {
              if ((a[col] as string) < (b[col] as string)) return asc ? -1 : 1;
              if ((a[col] as string) > (b[col] as string)) return asc ? 1 : -1;
              return 0;
            });
          }

          // limit
          if (this._limit !== undefined) rows = rows.slice(0, this._limit);

          // column selection & joins
          if (this._selectStr) {
            rows = rows.map((r) => this.resolveRow(r, this._selectStr!));
          }

          if (this._single) {
            return rows.length > 0
              ? { data: rows[0], error: null }
              : { data: null, error: { message: "Row not found" } };
          }
          if (this._maybeSingle) {
            return { data: rows[0] ?? null, error: null };
          }
          return { data: rows, error: null };
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { data: null, error: { message: msg } };
    }
  }

  // Make the builder thenable so both `await` and `.then()` work
  then(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) {
    const result = this.execute();
    const p = Promise.resolve(result);
    return p.then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// LocalChannel  –  Supabase Realtime-compatible channel
// ---------------------------------------------------------------------------

class LocalChannel {
  readonly name: string;
  private handlers: Array<{ table: string; callback: Listener }> = [];
  private unsubs: Array<() => void> = [];

  constructor(name: string) {
    this.name = name;
  }

  on(
    _event: string,
    config: { event: string; schema: string; table: string; filter?: string },
    callback: Listener,
  ): this {
    this.handlers.push({ table: config.table, callback });
    return this;
  }

  subscribe(): this {
    for (const h of this.handlers) {
      this.unsubs.push(db.addListener(h.table, h.callback));
    }
    return this;
  }

  unsubscribe() {
    for (const fn of this.unsubs) fn();
    this.unsubs = [];
  }
}

// ---------------------------------------------------------------------------
// Public API  –  drop-in replacement for the Supabase JS client
// ---------------------------------------------------------------------------

const channels = new Map<string, LocalChannel>();

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  channel(name: string): LocalChannel {
    const ch = new LocalChannel(name);
    channels.set(name, ch);
    return ch;
  },

  removeChannel(channel: LocalChannel) {
    channel.unsubscribe();
    channels.delete(channel.name);
  },
};
