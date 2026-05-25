import { createRequire } from 'module';
import path from 'path';
import {
  checkRequiredSqlPatterns,
  compareResults,
  executeQuery,
  loadSQLTables,
  SQLCompareResult,
  SQLResult,
  SQLTableConfig,
} from '@/lib/sql-engine';

const require = createRequire(import.meta.url);

interface VerifyServerSqlAnswerArgs {
  tables: SQLTableConfig[];
  query: string;
  expected: SQLResult;
  ordered?: boolean;
  numericTolerance?: number;
  requiredPatterns?: string[];
}

export async function verifyServerSqlAnswer({
  tables,
  query,
  expected,
  ordered,
  numericTolerance,
  requiredPatterns,
}: VerifyServerSqlAnswerArgs): Promise<{ passed: boolean; actual?: SQLResult; feedback: SQLCompareResult }> {
  const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs');
  const duckdbDist = path.join(process.cwd(), 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
  const bundles = {
    mvp: { mainModule: path.join(duckdbDist, 'duckdb-mvp.wasm') },
    eh: { mainModule: path.join(duckdbDist, 'duckdb-eh.wasm') },
  };
  const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await db.instantiate();
  db.open({});
  const conn = db.connect();

  try {
    await loadSQLTables(conn, tables);
    const actual = await executeQuery(conn, query, false, { limit: null });
    const patternCheck = checkRequiredSqlPatterns(query, requiredPatterns);
    if (!patternCheck.passed) {
      return {
        passed: false,
        actual,
        feedback: {
          passed: false,
          matchedRows: 0,
          totalRows: expected.rows.length,
          message: patternCheck.message,
        },
      };
    }
    const feedback = compareResults(actual, expected, { ordered, numericTolerance });
    return { passed: feedback.passed, actual, feedback };
  } finally {
    try { conn.close(); } catch {}
    try { db.dropFiles?.(); } catch {}
    try { db.reset?.(); } catch {}
  }
}
