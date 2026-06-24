'use client';

// Read-only renderer for interactive lesson content (lesson.doc).
//
// Uses a non-editable TipTap instance with the SAME shared extensions as the
// authoring editor, so every custom node view (callout, and later accordion /
// tabs / knowledge check / runnable code) renders identically to how it was
// authored. This component replaces the legacy `dangerouslySetInnerHTML` lesson
// body path on every player surface when `lesson.doc` is present.

import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { lessonExtensions } from '@/components/lesson/extensions';
import { LessonContentStyles } from '@/components/lesson/LessonContentStyles';
import { GlossaryTooltip } from '@/components/lesson/GlossaryTooltip';
import { LessonRuntimeProvider } from '@/components/lesson/LessonRuntimeContext';
import { useTenant } from '@/components/TenantProvider';
import { collectRunnableSetup, type LessonDoc } from '@/lib/lesson-doc';

interface LessonRendererProps {
  doc: LessonDoc;
  isDark?: boolean;
  className?: string;
}

export function LessonRenderer({ doc, isDark = false, className = '' }: LessonRendererProps) {
  const { primaryColor } = useTenant();
  // Combined setup from the lesson's shared runnable blocks seeds one shared runtime.
  const { setupSql, setupPython } = useMemo(() => collectRunnableSetup(doc), [doc]);
  const editor = useEditor({
    editable: false,
    content: doc as Record<string, unknown>,
    extensions: lessonExtensions,
    immediatelyRender: false, // required under Next SSR to avoid hydration mismatch
  });

  // Re-load content when the lesson changes (e.g. navigating between slides while
  // the renderer instance is reused).
  useEffect(() => {
    if (editor && doc) editor.commands.setContent(doc as Record<string, unknown>);
  }, [editor, doc]);

  if (!editor) return null;

  return (
    <div
      className={`lesson-content ${isDark ? 'dark' : ''} ${className}`.trim()}
      style={primaryColor ? ({ '--lesson-accent-base': primaryColor } as React.CSSProperties) : undefined}
    >
      <LessonContentStyles />
      <LessonRuntimeProvider setupSql={setupSql} setupPython={setupPython}>
        <EditorContent editor={editor} />
      </LessonRuntimeProvider>
      <GlossaryTooltip />
    </div>
  );
}
