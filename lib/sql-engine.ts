export interface SQLTableConfig {
  id?: string;
  tableName: string;
  fileName?: string;
  fileUrl?: string;
  csvUrl?: string;
  seedSql?: string;
}

export interface SQLRowsTableConfig {
  tableName: string;
  rows: unknown[][];
}

export interface SQLResult {
  columns: string[];
  rows: unknown[][];
  totalRows?: number;
  capped?: boolean;
}

export interface SQLCompareOptions {
  ordered?: boolean;
  numericTolerance?: number;
}

export interface SQLCompareResult {
  passed: boolean;
  matchedRows: number;
  totalRows: number;
  message: string;
}

export interface SQLRuntime {
  db: any;
  conn: any;
  tables: { tableName: string; columns: { name: string; type: string }[]; rowCount: number }[];
  close: () => Promise<void>;
}

const MUTATING_SQL = /\b(create|insert|update|delete|drop|alter|truncate|copy|attach|detach|install|load|pragma|export|import|vacuum)\b/i;
export const STUDENT_RESULT_LIMIT = 500;

function quoteIdent(name: string) {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function stripSqlNameMarkup(raw: string) {
  return raw.trim().replace(/^`([^`]+)`$/, '$1');
}

function normalizeTableName(raw: string) {
  return stripSqlNameMarkup(raw).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'table_data';
}

function scalarToSql(value: unknown, targetType?: string) {
  const normalized = normalizeImportedScalar(value);
  if (normalized == null || String(normalized).trim() === '') return 'NULL';
  if (targetType === 'DATE') {
    const date = normalizeDateScalar(normalized);
    if (date) return `'${date}'`;
  }
  if (normalized instanceof Date && !Number.isNaN(normalized.getTime())) return `'${normalized.toISOString().slice(0, 10)}'`;
  if (typeof normalized === 'number' && Number.isFinite(normalized)) return String(normalized);
  if (typeof normalized === 'boolean') return normalized ? 'TRUE' : 'FALSE';
  const text = String(normalized);
  const asNum = Number(text);
  if (text.trim() !== '' && Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(text.trim())) return text.trim();
  return `'${text.replace(/'/g, "''")}'`;
}

function inferSqlType(values: unknown[], columnName = '') {
  const present = values.map(normalizeImportedScalar).filter(v => v != null && String(v).trim() !== '');
  if (!present.length) return 'VARCHAR';
  if (nameSuggestsDate(columnName) && present.every(v => !!normalizeDateScalar(v))) return 'DATE';
  if (present.every(v => /^-?\d+$/.test(String(v).trim()))) return 'BIGINT';
  if (present.every(v => /^-?\d+(\.\d+)?$/.test(String(v).trim()))) return 'DOUBLE';
  if (present.every(v => isDateLikeValue(v))) return 'DATE';
  return 'VARCHAR';
}

function stripWrappedQuotes(value: string): string {
  let text = value.trim();
  for (let i = 0; i < 6; i += 1) {
    const unescaped = text.replace(/\\"/g, '"').replace(/\\'/g, "'");
    if (unescaped !== text) {
      text = unescaped.trim();
      continue;
    }
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1).trim();
      continue;
    }
    if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
      text = text.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return text;
}

function normalizeImportedScalar(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return stripWrappedQuotes(value);
}

function isDateLikeValue(value: unknown): boolean {
  if (value instanceof Date) return true;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return true;
  return false;
}

function nameSuggestsDate(columnName: string): boolean {
  return /(^|_)(date|dob|created_at|updated_at|timestamp|time)(_|$)/i.test(columnName);
}

function formatEpochDate(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  const ms = abs >= 1_000_000_000_000 ? value : abs >= 1_000_000_000 ? value * 1000 : null;
  if (ms == null) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2200) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeDateScalar(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = stripWrappedQuotes(String(value).trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? Number(`20${slash[3]}`) : Number(slash[3]);
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  if (/^-?\d{10,13}$/.test(text)) return formatEpochDate(Number(text));
  return null;
}

function normalizeQueryValue(value: unknown, columnName: string): unknown {
  let normalized = normalizeImportedScalar(value);
  const dateColumn = nameSuggestsDate(columnName);
  if (dateColumn && typeof normalized === 'number') {
    return formatEpochDate(normalized) ?? normalized;
  }
  if (dateColumn && typeof normalized === 'bigint') {
    return formatEpochDate(Number(normalized)) ?? normalized.toString();
  }
  if (typeof normalized === 'string') {
    const cleaned = stripWrappedQuotes(normalized);
    if (dateColumn) return normalizeDateScalar(cleaned) ?? cleaned;
    return cleaned;
  }
  return normalized;
}

function formatScaledDecimal(value: unknown, scale: number): string | null {
  const text = stripWrappedQuotes(String(value).trim());
  if (/^-?\d+$/.test(text)) {
    const negative = text.startsWith('-');
    const digits = negative ? text.slice(1) : text;
    const padded = digits.padStart(scale + 1, '0');
    const whole = padded.slice(0, -scale) || '0';
    const fractional = padded.slice(-scale);
    return `${negative ? '-' : ''}${whole}.${fractional}`;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return (numeric / (10 ** scale)).toFixed(scale);
}

function stripSqlForValidation(sql: string): string {
  let out = '';
  let quote: '"' | "'" | '`' | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (quote) {
      if (ch === quote && sql[i - 1] !== '\\') quote = null;
      out += ' ';
      continue;
    }
    if (ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') { out += ' '; i += 1; }
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { out += ' '; i += 1; }
      out += '  ';
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function splitSqlStatements(sql: string): string[] {
  const stripped = stripSqlForValidation(sql);
  return stripped.split(';').map(s => s.trim()).filter(Boolean);
}

function normalizeComparableValue(value: unknown, tolerance = 0, columnName = ''): unknown {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const dateColumn = nameSuggestsDate(columnName);
  if (dateColumn && typeof value === 'number') return formatEpochDate(value) ?? value;
  if (dateColumn && typeof value === 'bigint') return formatEpochDate(Number(value)) ?? value.toString();
  if (typeof value === 'bigint') {
    const n = Number(value);
    if (Number.isFinite(n)) return tolerance > 0 ? n : Number(n.toFixed(10));
    return value.toString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return tolerance > 0 ? value : Number(value.toFixed(10));
  }
  if (typeof value === 'boolean') return value;

  const text = stripWrappedQuotes(String(value).trim());
  if (text === '') return '';

  const date = normalizeDateScalar(text);
  if (date) return date;

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return tolerance > 0 ? n : Number(n.toFixed(10));
  }

  return text;
}

function rowKey(row: unknown[], tolerance = 0, columns: string[] = []): string {
  return JSON.stringify(row.map((value, index) => normalizeComparableValue(value, tolerance, columns[index] ?? '')));
}

function rowsMultiset(rows: unknown[][], tolerance = 0, columns: string[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = rowKey(row, tolerance, columns);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function validateStudentSql(sql: string): string | null {
  const trimmed = sql.trim();
  if (!trimmed) return 'Write a SELECT query before running it.';
  const stripped = stripSqlForValidation(trimmed);
  if (MUTATING_SQL.test(stripped)) return 'Only read-only SELECT queries are allowed in course exercises.';
  const statements = splitSqlStatements(trimmed);
  if (statements.length > 1) return 'Run one SELECT statement at a time.';
  if (!/^(with|select)\b/i.test(stripped.trim())) return 'Your query must start with SELECT or WITH.';
  return null;
}

export async function initSQLRuntime(tables: SQLTableConfig[]): Promise<SQLRuntime> {
  const duckdb = await import('@duckdb/duckdb-wasm');
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  // Use a dedicated setup connection for loading data + metadata queries so that
  // any abandoned Promise.race timeouts in safeMetadataQuery never contaminate
  // the student query connection.
  const setupConn = await db.connect();
  const loadedTables = await loadSQLTables(setupConn, tables);
  await setupConn.close().catch(() => {});

  const conn = await db.connect();

  return {
    db,
    conn,
    tables: loadedTables,
    close: async () => {
      await conn.close().catch(() => {});
      await db.terminate().catch(() => {});
    },
  };
}

export async function initSQLRuntimeFromRows(tables: SQLRowsTableConfig[]): Promise<SQLRuntime> {
  const duckdb = await import('@duckdb/duckdb-wasm');
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  const setupConn = await db.connect();
  for (const table of tables) {
    await loadRows(setupConn, normalizeTableName(table.tableName), table.rows);
  }
  const loadedTables = await discoverSQLTables(setupConn);
  await setupConn.close().catch(() => {});

  const conn = await db.connect();

  return {
    db,
    conn,
    tables: loadedTables,
    close: async () => {
      await conn.close().catch(() => {});
      await db.terminate().catch(() => {});
    },
  };
}

export async function loadSQLTables(conn: any, tables: SQLTableConfig[]): Promise<SQLRuntime['tables']> {
  for (const table of tables) {
    const tableName = normalizeTableName(table.tableName);
    if (table.seedSql?.trim()) {
      await conn.query(table.seedSql);
    } else {
      const url = table.fileUrl || table.csvUrl;
      if (!url) continue;
      const lower = url.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Dataset fetch failed: ${url} (HTTP ${res.status})`);
        const wb = XLSX.read(await res.arrayBuffer(), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        await loadRows(conn, tableName, rows);
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Dataset fetch failed: ${url} (HTTP ${res.status})`);
        const csv = await res.text();
        const Papa = await import('papaparse');
        const parsed = Papa.parse<string[]>(csv, {
          delimiter: lower.endsWith('.tsv') ? '\t' : '',
          skipEmptyLines: true,
        });
        if (parsed.errors.length) throw new Error(parsed.errors[0]?.message || 'Could not parse dataset.');
        await loadRows(conn, tableName, parsed.data);
      }
    }
  }

  return discoverSQLTables(conn);
}

async function discoverSQLTables(conn: any): Promise<SQLRuntime['tables']> {
  // Discover every table that actually exists in the DB (catches all tables created by seedSql)
  const allTables = await safeMetadataQuery(
    conn,
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name`,
  );
  const loadedTables: SQLRuntime['tables'] = [];
  for (const row of allTables.rows) {
    const tableName = String(row[0] ?? '');
    if (!tableName) continue;
    const schema = await safeMetadataQuery(
      conn,
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName.replace(/'/g, "''")}' AND table_schema = 'main' ORDER BY ordinal_position`,
    );
    const count = await safeMetadataQuery(conn, `SELECT COUNT(*) AS count FROM ${quoteIdent(tableName)}`);
    loadedTables.push({
      tableName,
      columns: schema.rows.map(r => ({ name: String(r[0] ?? ''), type: String(r[1] ?? '') })),
      rowCount: Number(count.rows[0]?.[0] ?? 0),
    });
  }
  return loadedTables;
}

async function safeMetadataQuery(conn: any, sql: string): Promise<SQLResult> {
  try {
    return await Promise.race([
      executeQuery(conn, sql, true),
      new Promise<SQLResult>((_, reject) => setTimeout(() => reject(new Error('SQL metadata lookup timed out')), 5000)),
    ]);
  } catch (err) {
    console.warn('[sql-exercise] metadata lookup skipped', err);
    return { columns: [], rows: [] };
  }
}

async function loadRows(conn: any, tableName: string, rows: unknown[][]) {
  if (!rows.length) throw new Error(`No rows found for ${tableName}.`);
  const headers = rows[0].map((h, i) => normalizeTableName(String(h || `column_${i + 1}`)));
  const body = rows.slice(1);
  const types = headers.map((header, i) => inferSqlType(body.slice(0, 100).map(row => row[i]), header));
  await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
  await conn.query(`CREATE TABLE ${quoteIdent(tableName)} (${headers.map((h, i) => `${quoteIdent(h)} ${types[i]}`).join(', ')})`);
  const chunkSize = 250;
  for (let i = 0; i < body.length; i += chunkSize) {
    const chunk = body.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const values = chunk.map(row => `(${headers.map((_, idx) => scalarToSql(row[idx], types[idx])).join(', ')})`).join(', ');
    await conn.query(`INSERT INTO ${quoteIdent(tableName)} VALUES ${values}`);
  }
}

export async function executeQuery(conn: any, sql: string, trusted = false, options: { limit?: number | null } = {}): Promise<SQLResult> {
  if (!trusted) {
    const validation = validateStudentSql(sql);
    if (validation) throw new Error(validation);
  }
  const limit = options.limit === undefined ? (trusted ? null : STUDENT_RESULT_LIMIT) : options.limit;
  const baseSql = sql.replace(/;\s*$/, '');
  const querySql = limit == null ? sql : `SELECT * FROM (${baseSql}) AS student_query_limit LIMIT ${limit}`;
  const result = await conn.query(querySql);
  const fields = result.schema.fields;
  const rows = result.toArray().map((row: any) => fields.map((field: any) => {
    const val = row[field.name];
    if (val == null) return null;

    const typeName: string = field.type?.constructor?.name ?? '';
    const typeId: number = field.type?.typeId ?? -1;

    // Arrow Date32 (DateDay, days) or Date64 (DateMillisecond, ms) -- typeId 8 covers both
    const isDateType = typeId === 8 || typeName === 'DateDay' || typeName === 'DateMillisecond' || typeName === 'Date32' || typeName === 'Date64';
    if (isDateType && typeof val === 'number') {
      // values < 100,000 are days since epoch; larger values are milliseconds
      const ms = val < 100_000 ? val * 86_400_000 : val;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }

    // JS Date object (some Arrow versions auto-convert Date32/Date64)
    if (val instanceof Date) {
      if (Number.isNaN(val.getTime())) return '';
      return val.toISOString().slice(0, 10);
    }

    // Arrow Timestamp (TIMESTAMP columns) -- value is microseconds since epoch as BigInt
    if (typeof val === 'bigint' && (typeName === 'Timestamp' || typeName.startsWith('Timestamp'))) {
      const ms = val / BigInt(1000);
      const d = new Date(Number(ms));
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Arrow Decimal (DECIMAL columns) -- preserve scale
    const scale: number | undefined = field.type?.scale;
    if (scale != null && scale > 0) {
      const scaled = formatScaledDecimal(val, scale);
      if (scaled != null) return scaled;
    }

    // Any remaining BigInt (plain INTEGER/BIGINT columns not caught above) -- convert to
    // number so rows are JSON-serializable and compare equal to pre-stored numeric values.
    if (typeof val === 'bigint') {
      const n = Number(val);
      return Number.isFinite(n) ? n : val.toString();
    }

    return normalizeQueryValue(val, field.name);
  }));
  let totalRows = rows.length;
  let capped = false;
  if (limit != null && rows.length >= limit) {
    capped = true;
    try {
      const countResult = await conn.query(`SELECT COUNT(*) AS count FROM (${baseSql}) AS student_query_count`);
      totalRows = Number(countResult.toArray()[0]?.count ?? rows.length);
      capped = totalRows > rows.length;
    } catch {
      totalRows = rows.length;
    }
  }
  return { columns: result.schema.fields.map((field: any) => field.name), rows, totalRows, capped };
}

export function compareResults(actual: SQLResult, expected: SQLResult, options: SQLCompareOptions = {}): SQLCompareResult {
  const tolerance = options.numericTolerance ?? 0;
  if (actual.columns.length !== expected.columns.length) {
    return { passed: false, matchedRows: 0, totalRows: expected.rows.length, message: `Expected ${expected.columns.length} columns, got ${actual.columns.length}.` };
  }
  const actualColumns = actual.columns.map(c => c.toLowerCase());
  const expectedColumns = expected.columns.map(c => c.toLowerCase());
  if (actualColumns.some((c, i) => c !== expectedColumns[i])) {
    return { passed: false, matchedRows: 0, totalRows: expected.rows.length, message: 'Column names or order do not match the expected result.' };
  }
  if (actual.rows.length !== expected.rows.length) {
    return { passed: false, matchedRows: Math.min(actual.rows.length, expected.rows.length), totalRows: expected.rows.length, message: `Expected ${expected.rows.length} rows, got ${actual.rows.length}.` };
  }

  const eq = (a: unknown, b: unknown, columnName = '') => {
    if (tolerance > 0 && Number.isFinite(Number(a)) && Number.isFinite(Number(b))) {
      return Math.abs(Number(a) - Number(b)) <= tolerance;
    }
    return normalizeComparableValue(a, tolerance, columnName) === normalizeComparableValue(b, tolerance, columnName);
  };
  const rowEq = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => eq(v, b[i], expected.columns[i] ?? actual.columns[i] ?? ''));
  const firstOrderedMismatch = () => {
    for (let rowIndex = 0; rowIndex < expected.rows.length; rowIndex += 1) {
      const actualRow = actual.rows[rowIndex] ?? [];
      const expectedRow = expected.rows[rowIndex] ?? [];
      if (actualRow.length !== expectedRow.length) {
        return `First mismatch is row ${rowIndex + 1}: expected ${expectedRow.length} values, got ${actualRow.length}.`;
      }
      for (let colIndex = 0; colIndex < expectedRow.length; colIndex += 1) {
        const column = expected.columns[colIndex] ?? actual.columns[colIndex] ?? `column ${colIndex + 1}`;
        if (!eq(actualRow[colIndex], expectedRow[colIndex], column)) {
          return `First mismatch is row ${rowIndex + 1}, ${column}: expected ${String(expectedRow[colIndex] ?? 'NULL')}, got ${String(actualRow[colIndex] ?? 'NULL')}.`;
        }
      }
    }
    return 'Rows contain the same count but values do not match the expected result.';
  };
  const ordered = options.ordered ?? false;
  if (ordered) {
    const matchedRows = actual.rows.filter((row, i) => rowEq(row, expected.rows[i] ?? [])).length;
    return {
      passed: matchedRows === expected.rows.length,
      matchedRows,
      totalRows: expected.rows.length,
      message: matchedRows === expected.rows.length ? 'Result matches.' : `${matchedRows}/${expected.rows.length} rows matched in order. ${firstOrderedMismatch()}`,
    };
  }
  const actualCounts = rowsMultiset(actual.rows, tolerance, actual.columns);
  const expectedCounts = rowsMultiset(expected.rows, tolerance, expected.columns);
  let matchedRows = 0;
  for (const [key, expectedCount] of expectedCounts) {
    matchedRows += Math.min(actualCounts.get(key) ?? 0, expectedCount);
  }
  return {
    passed: matchedRows === expected.rows.length,
    matchedRows,
    totalRows: expected.rows.length,
    message: matchedRows === expected.rows.length
      ? 'Result matches.'
      : `${matchedRows}/${expected.rows.length} rows matched. Check that every returned value matches the expected result, not just the row count.`,
  };
}

export function checkRequiredSqlPatterns(sqlText: string, patterns?: string[]): { passed: boolean; missing: string[]; message: string } {
  const required = (patterns ?? []).map(pattern => pattern.trim()).filter(Boolean);
  if (!required.length) return { passed: true, missing: [], message: 'All required SQL patterns are present.' };

  const compactSql = sqlText.replace(/\s+/g, ' ').trim();
  const lowerSql = compactSql.toLowerCase();
  const missing = required.filter(pattern => {
    const regexMatch = pattern.match(/^\/(.+)\/([a-z]*)$/i);
    if (regexMatch) {
      try {
        return !new RegExp(regexMatch[1], regexMatch[2] || 'i').test(sqlText);
      } catch {
        return true;
      }
    }

    if (/^[a-z_][a-z0-9_]*$/i.test(pattern)) {
      return !new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sqlText);
    }

    return !lowerSql.includes(pattern.replace(/\s+/g, ' ').trim().toLowerCase());
  });

  return {
    passed: missing.length === 0,
    missing,
    message: missing.length ? `Missing required SQL: ${missing.join(', ')}` : 'All required SQL patterns are present.',
  };
}

export interface DatasetTablePreview {
  name: string;
  columns: string[];
  rows: string[][];
  rowCount: number;
}

/**
 * A compact preview of the tables in a SQL runtime: column list + a few sample rows per
 * table. Powers the runnable-code "Available data" panel. Uses the runtime's discovered
 * table metadata and trusted SELECT ... LIMIT queries (read-only).
 */
export async function previewSqlTables(runtime: SQLRuntime, opts: { maxTables?: number; sampleRows?: number } = {}): Promise<DatasetTablePreview[]> {
  const maxTables = opts.maxTables ?? 8;
  const sampleRows = opts.sampleRows ?? 3;
  const out: DatasetTablePreview[] = [];
  for (const table of runtime.tables.slice(0, maxTables)) {
    let columns = table.columns.map(c => c.name);
    let rows: string[][] = [];
    try {
      const res = await executeQuery(runtime.conn, `SELECT * FROM ${quoteIdent(table.tableName)} LIMIT ${sampleRows}`, true);
      if (res.columns.length) columns = res.columns;
      rows = res.rows.map(r => r.map(cell => (cell == null ? 'NULL' : String(cell))));
    } catch { /* fall back to column metadata with no sample rows */ }
    out.push({ name: table.tableName, columns, rows, rowCount: table.rowCount });
  }
  return out;
}
