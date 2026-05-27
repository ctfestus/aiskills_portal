import {
  compareResults,
  executeQuery,
  initSQLRuntime,
  SQLCompareResult,
  SQLResult,
  SQLTableConfig,
} from '@/lib/sql-engine';

export interface SQLExerciseQuestion {
  id?: string;
  question?: string;
  type?: string;
  sqlTables?: SQLTableConfig[];
  sqlSolution?: string;
  sqlExpectedResult?: SQLResult;
  sqlResultOrdered?: boolean;
  sqlNumericTolerance?: number;
  sqlRequiredPatterns?: string[];
}

export interface SQLPreflightIssue {
  questionId: string;
  questionLabel: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface SQLPreflightResult<T extends SQLExerciseQuestion> {
  questions: T[];
  computedCount: number;
  issues: SQLPreflightIssue[];
}

function questionLabel(question: SQLExerciseQuestion, index: number) {
  const preview = question.question?.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `Q${index + 1}${preview ? `: ${preview}` : ''}`;
}

function sameResult(actual: SQLResult, expected: SQLResult, question: SQLExerciseQuestion): SQLCompareResult {
  return compareResults(actual, expected, {
    ordered: !!question.sqlResultOrdered,
    numericTolerance: Number(question.sqlNumericTolerance ?? 0),
  });
}

function splitOrderExpressions(orderByClause: string): string[] {
  const expressions: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;

  for (let i = 0; i < orderByClause.length; i += 1) {
    const ch = orderByClause[i];
    if (quote) {
      current += ch;
      if (ch === quote && orderByClause[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) expressions.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) expressions.push(current.trim());
  return expressions;
}

function getOrderByExpressions(sql: string): string[] {
  const compact = sql.replace(/\s+/g, ' ').trim();
  const match = compact.match(/\border\s+by\s+(.+?)(?:\blimit\b|\boffset\b|\bfetch\b|$)/i);
  return match ? splitOrderExpressions(match[1]) : [];
}

function hasLimit(sql: string) {
  return /\blimit\s+\d+\b/i.test(sql);
}

function getLimitValue(sql: string): number | null {
  const match = sql.match(/\blimit\s+(\d+)\b/i);
  if (!match) return null;
  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? limit : null;
}

function withoutLimit(sql: string) {
  return sql.replace(/\blimit\s+\d+\b/i, '').replace(/;\s*$/, '');
}

function orderExpressionColumn(expression: string) {
  const cleaned = expression
    .replace(/\s+(asc|desc)\b/ig, '')
    .replace(/\s+nulls\s+(first|last)\b/ig, '')
    .trim();
  const match = cleaned.match(/^(?:"?([a-z_][a-z0-9_]*)"?\.)?"?([a-z_][a-z0-9_]*)"?$/i);
  return match?.[2] ?? null;
}

function valuesTie(a: unknown, b: unknown) {
  if (a == null || b == null) return a == null && b == null;
  if (Number.isFinite(Number(a)) && Number.isFinite(Number(b))) return Number(a) === Number(b);
  return String(a).trim() === String(b).trim();
}

function addSecondarySort(sql: string, tiebreakerColumn: string): string {
  // Inject ", tiebreakerColumn ASC" immediately before the LIMIT clause
  return sql.replace(/(\blimit\s+\d+\b)/i, `, ${tiebreakerColumn} ASC $1`);
}

// Returns the fixed SQL with a secondary sort injected, or null if no fix is needed.
async function autoFixTieOrder(question: SQLExerciseQuestion, conn: any): Promise<string | null> {
  const sql = question.sqlSolution ?? '';
  const limit = getLimitValue(sql);
  if (!limit || !/\border\s+by\b/i.test(sql)) return null;

  const expressions = getOrderByExpressions(sql);
  if (expressions.length !== 1) return null; // already has a compound sort key

  const orderColumn = orderExpressionColumn(expressions[0]);
  if (!orderColumn) return null;

  try {
    const fullResult = await executeQuery(conn, withoutLimit(sql), false, { limit: null });
    if (fullResult.rows.length <= limit) return null;

    const columnIndex = fullResult.columns.findIndex(c => c.toLowerCase() === orderColumn.toLowerCase());
    if (columnIndex < 0) return null;

    const cutoffRow = fullResult.rows[limit - 1];
    const nextRow   = fullResult.rows[limit];
    if (!valuesTie(cutoffRow?.[columnIndex], nextRow?.[columnIndex])) return null;

    // Pick the best tiebreaker: prefer *_id / id columns, must differ from the sort column
    const tiebreaker =
      fullResult.columns.find(c => /^(id|.*_id)$/i.test(c) && c.toLowerCase() !== orderColumn.toLowerCase()) ??
      fullResult.columns.find(c => c.toLowerCase() !== orderColumn.toLowerCase());
    if (!tiebreaker) return null;

    return addSecondarySort(sql, tiebreaker);
  } catch {
    return null;
  }
}

export async function preflightSQLExercises<T extends SQLExerciseQuestion>(
  questions: T[],
  options: { requireComplete: boolean },
): Promise<SQLPreflightResult<T>> {
  const sqlQuestions = questions.filter(question => question.type === 'sql_exercise');
  if (!sqlQuestions.length) return { questions, computedCount: 0, issues: [] };

  const tableMap = new Map<string, SQLTableConfig>();
  for (const question of sqlQuestions) {
    for (const table of question.sqlTables ?? []) {
      const key = `${table.tableName}|${table.fileUrl || table.csvUrl || table.seedSql || ''}`;
      if (table.tableName && !tableMap.has(key)) tableMap.set(key, table);
    }
  }

  const runtime = await initSQLRuntime(Array.from(tableMap.values()));
  try {
    const updatedQuestions = [...questions];
    const issues: SQLPreflightIssue[] = [];
    let computedCount = 0;

    for (let i = 0; i < updatedQuestions.length; i += 1) {
      const question = updatedQuestions[i];
      if (question.type !== 'sql_exercise') continue;

      const label = questionLabel(question, i);
      if (!question.sqlSolution?.trim()) {
        issues.push({
          questionId: question.id || `sql-${i + 1}`,
          questionLabel: label,
          severity: 'warning',
          message: 'This SQL exercise has no solution query, so the platform cannot validate student answers.',
          suggestion: 'Add a solution query and compute the expected result before publishing.',
        });
        continue;
      }

      let recomputed: SQLResult;
      try {
        recomputed = await executeQuery(runtime.conn, question.sqlSolution, false, { limit: null });
      } catch (err: any) {
        issues.push({
          questionId: question.id || `sql-${i + 1}`,
          questionLabel: label,
          severity: 'warning',
          message: `The solution query could not run: ${err?.message || 'unknown SQL error'}`,
          suggestion: 'Fix the solution query or dataset setup, then compute the expected result again.',
        });
        continue;
      }

      // Auto-fix tie-breaking: if the ORDER BY cutoff row ties with the next row,
      // inject a secondary sort (a unique/id column) and recompute silently.
      const fixedSql = await autoFixTieOrder(question, runtime.conn);
      if (fixedSql) {
        try {
          recomputed = await executeQuery(runtime.conn, fixedSql, false, { limit: null });
          updatedQuestions[i] = { ...question, sqlSolution: fixedSql, sqlExpectedResult: recomputed };
          computedCount += 1;
          continue;
        } catch {
          // Fixed SQL failed for some reason; fall through to normal handling
        }
      }

      if (!question.sqlExpectedResult) {
        updatedQuestions[i] = { ...question, sqlExpectedResult: recomputed };
        computedCount += 1;
        continue;
      }

      const comparison = sameResult(recomputed, question.sqlExpectedResult, question);
      if (!comparison.passed) {
        issues.push({
          questionId: question.id || `sql-${i + 1}`,
          questionLabel: label,
          severity: 'warning',
          message: `The saved expected result is stale or inconsistent: ${comparison.message}`,
          suggestion: `Recompute the expected result from the current solution query. Current solution returns ${recomputed.rows.length} row${recomputed.rows.length === 1 ? '' : 's'}.`,
        });
      }
    }

    return { questions: updatedQuestions, computedCount, issues };
  } finally {
    await runtime.close();
  }
}

export function formatSQLPreflightIssue(issue: SQLPreflightIssue) {
  return `${issue.questionLabel}: ${issue.message}${issue.suggestion ? ` ${issue.suggestion}` : ''}`;
}
