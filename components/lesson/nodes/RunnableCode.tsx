'use client';

// Runnable code block: a code snippet with copy-always and, for SQL, an in-browser
// Run powered by DuckDB-wasm.
//
// SELF-CONTAINED: the node carries its own `code` and optional `setupSql` (a script
// that creates/seeds sample tables). On Run it lazily spins up its OWN DuckDB runtime
// via lib/sql-engine -- it never depends on an ambient CourseTaker/SQL-exercise
// runtime, so it works the same in courses, VE, and assignment players. The displayed
// query runs as a read-only SELECT (validated), same as graded SQL exercises.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Play, Copy, Check, Loader2 } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { initSQLRuntime, executeQuery, type SQLResult, type SQLRuntime } from '@/lib/sql-engine';

const LANGUAGES = ['sql', 'javascript', 'python', 'bash', 'json', 'plaintext'];
const MAX_VISIBLE_ROWS = 50;

function RunnableCodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string) || 'sql';
  const code = (node.attrs.code as string) || '';
  const setupSql = (node.attrs.setupSql as string) || '';
  const isSql = language === 'sql';

  if (editor.isEditable) {
    return (
      <NodeViewWrapper className="lesson-code" contentEditable={false}>
        <div className="lesson-code__bar">
          <select
            className="lesson-code__lang"
            value={language}
            onChange={(e) => updateAttributes({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {isSql && (
            <span className="lesson-code__hint" data-on={setupSql.trim() ? 'true' : 'false'}>
              {setupSql.trim() ? 'Runnable' : 'Add setup SQL to enable Run'}
            </span>
          )}
        </div>
        <NodeTextInput
          multiline
          className="lesson-code__editor"
          value={code}
          placeholder={isSql ? 'SELECT * FROM ...' : 'Code...'}
          onCommit={(v) => updateAttributes({ code: v })}
        />
        {isSql && (
          <div className="lesson-code__setup">
            <label className="lesson-code__setup-label">Setup SQL (optional) - creates sample tables before the query runs</label>
            <NodeTextInput
              multiline
              className="lesson-code__editor"
              value={setupSql}
              placeholder="CREATE TABLE ...; INSERT INTO ... VALUES ...;"
              onCommit={(v) => updateAttributes({ setupSql: v })}
            />
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return <RunnableCodePlayer language={language} initialCode={code} setupSql={setupSql} isSql={isSql} />;
}

function RunnableCodePlayer({ language, initialCode, setupSql, isSql }: {
  language: string;
  initialCode: string;
  setupSql: string;
  isSql: boolean;
}) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runtimeRef = useRef<SQLRuntime | null>(null);
  // Run is only offered when the block carries its own dataset (a setup script that
  // seeds tables). Without one, the block is a read-only, copyable snippet.
  const canRun = isSql && setupSql.trim().length > 0;

  // Tear the DuckDB runtime down when the block unmounts.
  useEffect(() => () => { runtimeRef.current?.close().catch(() => {}); }, []);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(code).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); },
      () => {},
    );
  }, [code]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      if (!runtimeRef.current) {
        runtimeRef.current = await initSQLRuntime(setupSql.trim() ? [{ tableName: 'setup', seedSql: setupSql }] : []);
      }
      setResult(await executeQuery(runtimeRef.current.conn, code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [code, setupSql]);

  return (
    <NodeViewWrapper className="lesson-code" contentEditable={false}>
      <div className="lesson-code__bar">
        <span className="lesson-code__lang-label">{language}</span>
        <div className="lesson-code__actions">
          {canRun && (
            <button type="button" className="lesson-code__btn" onClick={run} disabled={running}>
              {running ? <Loader2 className="lesson-code__spin" width={13} height={13} /> : <Play width={13} height={13} />}
              {running ? 'Running' : 'Run'}
            </button>
          )}
          <button type="button" className="lesson-code__btn" onClick={copy}>
            {copied ? <Check width={13} height={13} /> : <Copy width={13} height={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {canRun ? (
        <textarea
          className="lesson-code__editor lesson-code__editor--run"
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
        />
      ) : (
        <pre className="lesson-code__pre"><code>{code}</code></pre>
      )}

      {error && <div className="lesson-code__error">{error}</div>}
      {result && <ResultTable result={result} />}
    </NodeViewWrapper>
  );
}

function ResultTable({ result }: { result: SQLResult }) {
  const rows = result.rows.slice(0, MAX_VISIBLE_ROWS);
  const total = result.totalRows ?? result.rows.length;
  return (
    <div className="lesson-code__result">
      {result.columns.length > 0 ? (
        <div className="lesson-code__result-scroll">
          <table>
            <thead>
              <tr>{result.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((cell, ci) => <td key={ci}>{cell == null ? 'NULL' : String(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="lesson-code__result-note">
        {result.rows.length === 0
          ? 'Query ran. No rows returned.'
          : total > rows.length
            ? `Showing ${rows.length} of ${total} rows`
            : `${result.rows.length} row${result.rows.length === 1 ? '' : 's'}`}
      </p>
    </div>
  );
}

export const RunnableCode = Node.create({
  name: 'runnableCode',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      language: { default: 'sql' },
      code: { default: '' },
      setupSql: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'pre[data-runnable-code]' }];
  },

  // Fallback HTML: a static pre/code block (sanitizer keeps pre + code). Run/copy and
  // the setup script live only in the canonical doc.
  renderHTML({ node, HTMLAttributes }) {
    return ['pre', mergeAttributes(HTMLAttributes, { 'data-runnable-code': '' }), ['code', (node.attrs.code as string) || '']];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RunnableCodeView);
  },
});
