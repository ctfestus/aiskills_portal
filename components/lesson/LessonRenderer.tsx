'use client';

// Read-only renderer for interactive lesson content (lesson.doc).
//
// Uses a non-editable TipTap instance with the SAME shared extensions as the
// authoring editor, so every custom node view (callout, and later accordion /
// tabs / knowledge check / runnable code) renders identically to how it was
// authored. This component replaces the legacy `dangerouslySetInnerHTML` lesson
// body path on every player surface when `lesson.doc` is present.

import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { lessonExtensions } from '@/components/lesson/extensions';
import { LessonContentStyles } from '@/components/lesson/LessonContentStyles';
import { GlossaryTooltip } from '@/components/lesson/GlossaryTooltip';
import { LessonRuntimeProvider } from '@/components/lesson/LessonRuntimeContext';
import { useTenant } from '@/components/TenantProvider';
import { collectRunnableSetup, sameContent, type LessonDoc } from '@/lib/lesson-doc';

interface LessonRendererProps {
  doc: LessonDoc;
  isDark?: boolean;
  className?: string;
  accentColor?: string;
}

export function LessonRenderer({ doc, isDark = false, className = '', accentColor }: LessonRendererProps) {
  const { primaryColor } = useTenant();
  const lessonAccent = accentColor || primaryColor;
  // Combined setup from the lesson's shared runnable blocks seeds one shared runtime.
  const { setupSql, setupPython } = useMemo(() => collectRunnableSetup(doc), [doc]);
  // The doc last loaded into the editor, so a re-render passing an identical-but-new object does
  // not trigger a needless reload (see the effect below).
  const loaded = useRef<LessonDoc | null>(null);
  const editor = useEditor({
    editable: false,
    content: doc as Record<string, unknown>,
    extensions: lessonExtensions,
    immediatelyRender: false, // required under Next SSR to avoid hydration mismatch
  });

  // Re-load content when the lesson changes (e.g. navigating between slides while
  // the renderer instance is reused). Skipped when the doc is only a new object holding the same
  // content, and deferred past this commit either way: setContent re-renders the React node views
  // synchronously (flushSync), which React forbids while it is already rendering.
  useEffect(() => {
    if (!editor || !doc) return;
    if (loaded.current === null) { loaded.current = doc; return; } // content already set at init
    if (sameContent(loaded.current, doc)) return;
    loaded.current = doc;
    const id = setTimeout(() => {
      if (editor.isDestroyed) return;
      editor.commands.setContent(doc as Record<string, unknown>);
    }, 0);
    return () => clearTimeout(id);
  }, [editor, doc]);

  if (!editor) return null;

  return (
    <div
      className={`lesson-content ${isDark ? 'dark' : ''} ${className}`.trim()}
      style={lessonAccent ? ({ '--lesson-accent-base': lessonAccent } as React.CSSProperties) : undefined}
    >
      <LessonContentStyles />
      <LessonRuntimeProvider setupSql={setupSql} setupPython={setupPython} dark={isDark}>
        <EditorContent editor={editor} />
      </LessonRuntimeProvider>
      <GlossaryTooltip />
    </div>
  );
}
