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
  return question.id || question.question?.slice(0, 70) || `SQL exercise ${index + 1}`;
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

function hasOrderBy(sql: string) {
  return /\border\s+by\b/i.test(sql);
}

function hasLikelyTieBreaker(expressions: string[]) {
  if (expressions.length >= 2) return true;
  const onlyExpression = expressions[0]?.toLowerCase() ?? '';
  return /\b(id|_id|uuid|key)\b/.test(onlyExpression);
}

function ambiguityIssue(question: SQLExerciseQuestion, index: number): SQLPreflightIssue | null {
  const sql = question.sqlSolution ?? '';
  if (!hasLimit(sql) || !hasOrderBy(sql)) return null;

  const expressions = getOrderByExpressions(sql);
  if (hasLikelyTieBreaker(expressions)) return null;

  return {
    questionId: question.id || `sql-${index + 1}`,
    questionLabel: questionLabel(question, index),
    severity: 'error',
    message: 'The solution uses LIMIT after ORDER BY without a clear tie-breaker, so tied rows near the cutoff can be graded unpredictably.',
    suggestion: 'Add a stable secondary sort such as an id column, for example ORDER BY metric DESC, id ASC, then recompute the expected result.',
  };
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
          severity: options.requireComplete ? 'error' : 'warning',
          message: 'This SQL exercise has no solution query, so the platform cannot validate student answers.',
          suggestion: 'Add a solution query and compute the expected result before publishing.',
        });
        continue;
      }

      const ambiguous = ambiguityIssue(question, i);
      if (ambiguous) issues.push(ambiguous);

      let recomputed: SQLResult;
      try {
        recomputed = await executeQuery(runtime.conn, question.sqlSolution, false, { limit: null });
      } catch (err: any) {
        issues.push({
          questionId: question.id || `sql-${i + 1}`,
          questionLabel: label,
          severity: 'error',
          message: `The solution query could not run: ${err?.message || 'unknown SQL error'}`,
          suggestion: 'Fix the solution query or dataset setup, then compute the expected result again.',
        });
        continue;
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
          severity: options.requireComplete ? 'error' : 'warning',
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
