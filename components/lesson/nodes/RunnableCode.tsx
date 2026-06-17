'use client';

// Runnable code block: a code snippet with copy-always and, for SQL, an in-browser
// Run powered by DuckDB-wasm; for Python, powered by Pyodide.
//
// SELF-CONTAINED: the node carries its own `code`, optional `setupSql` (seeds tables
// for SQL), and optional `setupPython` (runs before the main block for Python). On Run
// it lazily spins up its OWN runtime via lib/sql-engine or lib/python-engine -- it never
// depends on an ambient runtime, so it works the same in courses, VE, and assignment
// players. SQL queries run read-only (validated); Python runs unrestricted.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Play, Copy, Check, Loader2 } from 'lucide-react';
import { NodeTextInput } from '@/components/lesson/nodes/NodeTextInput';
import { initSQLRuntime, executeQuery, type SQLResult, type SQLRuntime } from '@/lib/sql-engine';
import { initPythonRuntime, runPython, type PythonResult, type PythonRuntime } from '@/lib/python-engine';

const LANGUAGES = ['sql', 'javascript', 'python', 'bash', 'json', 'plaintext'];
const MAX_VISIBLE_ROWS = 50;

function RunnableCodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string) || 'sql';
  const code = (node.attrs.code as string) || '';
  const setupSql = (node.attrs.setupSql as string) || '';
  const setupPython = (node.attrs.setupPython as string) || '';
  const isSql = language === 'sql';
  const isPython = language === 'python';

  if (editor.isEditable) {
    const runnable = (isSql && setupSql.trim().length > 0) || isPython;
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
          {(isSql || isPython) && (
            <span className="lesson-code__hint" data-on={runnable ? 'true' : 'false'}>
              {runnable ? 'Runnable' : 'Copyable snippet'}
            </span>
          )}
        </div>
        <NodeTextInput
          multiline
          className="lesson-code__editor"
          value={code}
          placeholder={isSql ? 'SELECT * FROM ...' : isPython ? 'print("Hello, world!")' : 'Code...'}
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
        {isPython && (
          <div className="lesson-code__setup">
            <label className="lesson-code__setup-label">Setup Python (optional) - runs once before the main code block</label>
            <NodeTextInput
              multiline
              className="lesson-code__editor"
              value={setupPython}
              placeholder="# import libraries or define helper functions here"
              onCommit={(v) => updateAttributes({ setupPython: v })}
            />
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return <RunnableCodePlayer language={language} initialCode={code} setupSql={setupSql} setupPython={setupPython} isSql={isSql} isPython={isPython} />;
}

function RunnableCodePlayer({ language, initialCode, setupSql, setupPython, isSql, isPython }: {
  language: string;
  initialCode: string;
  setupSql: string;
  setupPython: string;
  isSql: boolean;
  isPython: boolean;
}) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);
  const [pyResult, setPyResult] = useState<PythonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sqlRuntimeRef = useRef<SQLRuntime | null>(null);
  const pyRuntimeRef = useRef<PythonRuntime | null>(null);

  // SQL blocks are only runnable when a setup script seeds sample tables.
  // Python blocks are always runnable.
  const canRun = (isSql && setupSql.trim().length > 0) || isPython;

  // Tear the DuckDB runtime down when the block unmounts (Pyodide is a singleton, no teardown needed).
  useEffect(() => () => { sqlRuntimeRef.current?.close().catch(() => {}); }, []);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(code).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); },
      () => {},
    );
  }, [code]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setPyResult(null);
    try {
      if (isSql) {
        if (!sqlRuntimeRef.current) {
          sqlRuntimeRef.current = await initSQLRuntime(setupSql.trim() ? [{ tableName: 'setup', seedSql: setupSql }] : []);
        }
        setResult(await executeQuery(sqlRuntimeRef.current.conn, code));
      } else if (isPython) {
        if (!pyRuntimeRef.current) {
          pyRuntimeRef.current = await initPythonRuntime(setupPython.trim() || undefined);
        }
        const out = await runPython(pyRuntimeRef.current, code);
        if (out.error) {
          setError(out.error);
        } else {
          setPyResult(out);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }, [code, setupSql, setupPython, isSql, isPython]);

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
      {pyResult && <PythonOutput result={pyResult} />}
    </NodeViewWrapper>
  );
}

function PythonOutput({ result }: { result: PythonResult }) {
  const hasStdout = result.stdout.trim().length > 0;
  const hasReturn = result.returnValue !== null && !hasStdout;
  const hasPlots = (result.plots ?? []).length > 0;
  if (!hasStdout && !hasReturn && !hasPlots) {
    return <p className="lesson-code__result-note">Code ran. No output.</p>;
  }
  return (
    <div className="lesson-code__stdout">
      {hasStdout && <pre className="lesson-code__stdout-pre">{result.stdout}</pre>}
      {hasReturn && <pre className="lesson-code__stdout-pre lesson-code__stdout-pre--return">Out: {result.returnValue}</pre>}
      {hasPlots && (
        <div className="lesson-code__plots">
          {(result.plots ?? []).map((src, idx) => (
            <div className="lesson-code__plot" key={`${idx}:${src.length}`}>
              <img src={src} alt={`Python plot ${idx + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
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
      setupPython: { default: '' },
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
