'use client';

// Shared per-lesson code runtime for runnable-code blocks.
//
// By default a runnable block uses ONE SQL + ONE Python runtime shared across the whole
// lesson (notebook-style): the combined setup from every shared block seeds it once, so
// a dataset defined in one block is queryable from every other shared block -- no need to
// repeat the setup. A block marked `dataScope: 'own'` opts out and runs its own isolated
// runtime instead (see RunnableCode). The provider is mounted by LessonRenderer and
// LessonEditor; node views read it via useLessonRuntime(). Each provider instance owns one
// lesson's runtime (LessonRenderer is keyed per lesson, so navigating remounts it fresh).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { initSQLRuntime, type SQLRuntime } from '@/lib/sql-engine';
import { initPythonRuntime, type PythonRuntime } from '@/lib/python-engine';

interface LessonRuntime {
  hasSharedSql: boolean;
  hasSharedPython: boolean;
  // The lesson's own dark state (the player surface sets it; may differ from the app
  // theme), so JS-themed bits like the CodeMirror editor and the portaled data popover
  // match the lesson instead of useTheme().
  dark: boolean;
  getSql: () => Promise<SQLRuntime>;
  getPython: () => Promise<PythonRuntime>;
}

const LessonRuntimeContext = createContext<LessonRuntime | null>(null);

export const useLessonRuntime = () => useContext(LessonRuntimeContext);

export function LessonRuntimeProvider({ setupSql, setupPython, dark, children }: {
  setupSql: string;
  setupPython: string;
  dark: boolean;
  children: ReactNode;
}) {
  // Promises are cached so concurrent Run clicks across blocks share one init.
  const sqlPromise = useRef<Promise<SQLRuntime> | null>(null);
  const sqlInstance = useRef<SQLRuntime | null>(null);
  const pyPromise = useRef<Promise<PythonRuntime> | null>(null);

  // The shared SQL runtime holds a DuckDB connection for the lesson's lifetime.
  useEffect(() => () => { sqlInstance.current?.close().catch(() => {}); }, []);

  useEffect(() => {
    const oldSql = sqlInstance.current;
    sqlPromise.current = null;
    sqlInstance.current = null;
    oldSql?.close().catch(() => {});
  }, [setupSql]);

  useEffect(() => {
    pyPromise.current = null;
  }, [setupPython]);

  const getSql = useCallback(() => {
    if (!sqlPromise.current) {
      const promise = initSQLRuntime(setupSql.trim() ? [{ tableName: 'lesson_setup', seedSql: setupSql }] : [])
        .then((rt) => {
          if (sqlPromise.current === promise) {
            sqlInstance.current = rt;
          } else {
            rt.close().catch(() => {});
          }
          return rt;
        });
      sqlPromise.current = promise;
    }
    return sqlPromise.current;
  }, [setupSql]);

  const getPython = useCallback(() => {
    if (!pyPromise.current) pyPromise.current = initPythonRuntime(setupPython.trim() || undefined);
    return pyPromise.current;
  }, [setupPython]);

  const value = useMemo<LessonRuntime>(() => ({
    hasSharedSql: setupSql.trim().length > 0,
    hasSharedPython: setupPython.trim().length > 0,
    dark,
    getSql,
    getPython,
  }), [setupSql, setupPython, dark, getSql, getPython]);

  return <LessonRuntimeContext.Provider value={value}>{children}</LessonRuntimeContext.Provider>;
}
