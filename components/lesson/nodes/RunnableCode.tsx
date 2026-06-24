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
import { useLessonRuntime } from '@/components/lesson/LessonRuntimeContext';
import { initSQLRuntime, executeQuery, type SQLResult, type SQLRuntime } from '@/lib/sql-engine';
import { initPythonRuntime, runPython, type PythonResult, type PythonRuntime } from '@/lib/python-engine';

const LANGUAGES = ['sql', 'javascript', 'python', 'bash', 'json', 'plaintext'];
const MAX_VISIBLE_ROWS = 50;

function RunnableCodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string) || 'sql';
  const code = (node.attrs.code as string) || '';
  const setupSql = (node.attrs.setupSql as string) || '';
  const setupPython = (node.attrs.setupPython as string) || '';
  const dataScope = (node.attrs.dataScope as string) === 'own' ? 'own' : 'shared';
  const isSql = language === 'sql';
  const isPython = language === 'python';
  const lessonRuntime = useLessonRuntime();

  if (editor.isEditable) {
    // Runnable when Python, or SQL that has data: its own setup, or (when shared) the
    // lesson's shared data defined by some other block.
    const sharedSql = dataScope === 'shared' && (lessonRuntime?.hasSharedSql ?? false);
    const runnable = isPython || (isSql && (setupSql.trim().length > 0 || sharedSql));
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
            <span className="lesson-code__bar-right">
              <span className="lesson-code__hint" data-on={runnable ? 'true' : 'false'}>
                {runnable ? 'Runnable' : 'Copyable snippet'}
              </span>
              <span className="lesson-code__scope" title="Where this block's data comes from">
                <button type="button" data-active={dataScope === 'shared' ? 'true' : 'false'} onMouseDown={(e) => { e.preventDefault(); updateAttributes({ dataScope: 'shared' }); }}>Shared data</button>
                <button type="button" data-active={dataScope === 'own' ? 'true' : 'false'} onMouseDown={(e) => { e.preventDefault(); updateAttributes({ dataScope: 'own' }); }}>This block only</button>
              </span>
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
            <label className="lesson-code__setup-label">
              {dataScope === 'shared'
                ? 'Setup SQL (optional) - shared with the whole lesson; every shared block can query these tables'
                : 'Setup SQL (optional) - this block only; creates sample tables before the query runs'}
            </label>
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
            <label className="lesson-code__setup-label">
              {dataScope === 'shared'
                ? 'Setup Python (optional) - shared with the whole lesson; runs once before the shared blocks'
                : 'Setup Python (optional) - this block only; runs before the main code block'}
            </label>
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

  return <RunnableCodePlayer language={language} initialCode={code} setupSql={setupSql} setupPython={setupPython} isSql={isSql} isPython={isPython} dataScope={dataScope} />;
}

function RunnableCodePlayer({ language, initialCode, setupSql, setupPython, isSql, isPython, dataScope }: {
  language: string;
  initialCode: string;
  setupSql: string;
  setupPython: string;
  isSql: boolean;
  isPython: boolean;
  dataScope: 'shared' | 'own';
}) {
  const lessonRuntime = useLessonRuntime();
  // Use the lesson's shared runtime unless this block opts out ('own') or there is no
  // provider (block used outside a lesson) -- then fall back to its own runtime.
  const shared = dataScope === 'shared' ? lessonRuntime : null;

  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SQLResult | null>(null);
  const [pyResult, setPyResult] = useState<PythonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sqlRuntimeRef = useRef<SQLRuntime | null>(null);
  const pyRuntimeRef = useRef<PythonRuntime | null>(null);

  // Python is always runnable. SQL needs data: its own setup, or (shared) the lesson's.
  const canRun = isPython || (isSql && (shared ? shared.hasSharedSql : setupSql.trim().length > 0));

  // Tear down only this block's OWN DuckDB runtime; the shared one is owned by the
  // provider. (Pyodide is a process singleton, no teardown.)
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
        let rt: SQLRuntime;
        if (shared) {
          rt = await shared.getSql();
        } else {
          if (!sqlRuntimeRef.current) {
            sqlRuntimeRef.current = await initSQLRuntime(setupSql.trim() ? [{ tableName: 'setup', seedSql: setupSql }] : []);
          }
          rt = sqlRuntimeRef.current;
        }
        setResult(await executeQuery(rt.conn, code));
      } else if (isPython) {
        let rt: PythonRuntime;
        if (shared) {
          rt = await shared.getPython();
        } else {
          if (!pyRuntimeRef.current) {
            pyRuntimeRef.current = await initPythonRuntime(setupPython.trim() || undefined);
          }
          rt = pyRuntimeRef.current;
        }
        const out = await runPython(rt, code);
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
  }, [code, setupSql, setupPython, isSql, isPython, shared]);

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
      // 'shared' (default): runs against the lesson's shared runtime, so this block's
      // setup is pooled with the other shared blocks and any of them can query it.
      // 'own': isolated -- this block runs only its own setup in its own runtime.
      dataScope: { default: 'shared' },
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
