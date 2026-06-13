'use client';

// Shared stylesheet for interactive lesson content. Both LessonEditor (authoring)
// and LessonRenderer (player) wrap their content in `.lesson-content` (plus `.dark`
// in dark mode), so this single stylesheet themes both surfaces identically and the
// React node views never need theme props. Rendering it twice is harmless.
//
// Palette stays within the platform guardrails: neutral / emerald / amber only.
// No indigo, purple, or blue accents.

export function LessonContentStyles() {
  return (
    <style>{`
.lesson-content { font-size: 15.5px; line-height: 1.6; color: #3f3f46; }
.lesson-content.dark { color: #d4d4d8; }
.lesson-content p { margin: 0 0 0.75rem; }
.lesson-content p:last-child { margin-bottom: 0; }
.lesson-content ul { list-style: disc; padding-left: 1.4rem; margin: 0.4rem 0 0.75rem; }
.lesson-content ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0 0.75rem; }
.lesson-content li { margin: 0.2rem 0; }
.lesson-content b, .lesson-content strong { font-weight: 700; color: #18181b; }
.lesson-content.dark b, .lesson-content.dark strong { color: #fafafa; }
.lesson-content i, .lesson-content em { font-style: italic; }
.lesson-content u { text-decoration: underline; }
.lesson-content a { color: #047857; text-decoration: underline; }
.lesson-content.dark a { color: #6ee7b7; }
.lesson-content a:hover { opacity: 0.8; }
.lesson-content h1 { font-size: 1.9rem; font-weight: 700; margin: 1.25rem 0 0.5rem; letter-spacing: -0.02em; color: #18181b; }
.lesson-content h2 { font-size: 1.6rem; font-weight: 700; margin: 1.25rem 0 0.4rem; letter-spacing: -0.02em; color: #18181b; }
.lesson-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.3rem; letter-spacing: -0.01em; color: #18181b; }
.lesson-content.dark h1, .lesson-content.dark h2, .lesson-content.dark h3 { color: #ffffff; }
.lesson-content h1:first-child, .lesson-content h2:first-child, .lesson-content h3:first-child { margin-top: 0; }
.lesson-content hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.25rem 0; }
.lesson-content.dark hr { border-top-color: #27272a; }

.lesson-content code { font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 0.88em; background: rgba(0,0,0,0.06); color: #166534; border-radius: 4px; padding: 1px 5px; }
.lesson-content.dark code { background: rgba(255,255,255,0.08); color: #86efac; }
.lesson-content pre { font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 0.85em; background: #f1f3f8; color: #1a1d2e; border-radius: 8px; padding: 12px 16px; margin: 0.75rem 0; overflow-x: auto; white-space: pre; }
.lesson-content.dark pre { background: #0f1120; color: #c9d1d9; }
.lesson-content pre code { background: none; padding: 0; border-radius: 0; color: inherit; font-size: inherit; }

.lesson-content blockquote { border-left: 3px solid #10b981; padding-left: 0.875rem; margin: 0.75rem 0; color: #52525b; font-style: normal; }
.lesson-content.dark blockquote { color: #a1a1aa; }

.lesson-content img { max-width: 100%; height: auto; border-radius: 10px; margin: 0.75rem 0; display: block; }
.lesson-content img.ProseMirror-selectednode { outline: 2px solid #10b981; outline-offset: 2px; }

.lesson-content table { border-collapse: collapse; width: 100%; margin: 0.9rem 0; font-size: 0.95em; overflow: hidden; }
.lesson-content th, .lesson-content td { border: 1px solid #e4e4e7; padding: 7px 11px; text-align: left; vertical-align: top; }
.lesson-content th { background: #f4f4f5; font-weight: 600; color: #18181b; }
.lesson-content.dark th, .lesson-content.dark td { border-color: #3f3f46; }
.lesson-content.dark th { background: rgba(255,255,255,0.05); color: #fafafa; }
.lesson-content .tableWrapper { overflow-x: auto; }
.lesson-content .column-resize-handle { background: #10b981; width: 3px; pointer-events: none; }
.lesson-content .selectedCell:after { background: rgba(16,185,129,0.12); content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 2; }

.lesson-content .lesson-callout { display: flex; flex-direction: column; gap: 6px; border-radius: 10px; border: 1px solid; padding: 12px 14px; margin: 0.9rem 0; }
.lesson-content .lesson-callout__head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; user-select: none; }
.lesson-content .lesson-callout__icon { flex-shrink: 0; }
.lesson-content .lesson-callout__label { flex: 1; }
.lesson-content .lesson-callout__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-callout__switch { display: inline-flex; gap: 3px; text-transform: none; letter-spacing: 0; }
.lesson-content .lesson-callout__switch button { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 999px; border: 1px solid transparent; background: rgba(0,0,0,0.05); color: inherit; cursor: pointer; opacity: 0.7; }
.lesson-content.dark .lesson-callout__switch button { background: rgba(255,255,255,0.08); }
.lesson-content .lesson-callout__switch button[data-active="true"] { opacity: 1; border-color: currentColor; }

.lesson-content .lesson-callout[data-variant="note"] { background: #f1f5f9; border-color: #cbd5e1; }
.lesson-content .lesson-callout[data-variant="note"] .lesson-callout__head { color: #475569; }
.lesson-content.dark .lesson-callout[data-variant="note"] { background: rgba(148,163,184,0.12); border-color: rgba(148,163,184,0.28); }
.lesson-content.dark .lesson-callout[data-variant="note"] .lesson-callout__head { color: #cbd5e1; }

.lesson-content .lesson-callout[data-variant="tip"] { background: #ecfdf5; border-color: #a7f3d0; }
.lesson-content .lesson-callout[data-variant="tip"] .lesson-callout__head { color: #047857; }
.lesson-content.dark .lesson-callout[data-variant="tip"] { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.3); }
.lesson-content.dark .lesson-callout[data-variant="tip"] .lesson-callout__head { color: #6ee7b7; }

.lesson-content .lesson-callout[data-variant="warning"] { background: #fffbeb; border-color: #fde68a; }
.lesson-content .lesson-callout[data-variant="warning"] .lesson-callout__head { color: #b45309; }
.lesson-content.dark .lesson-callout[data-variant="warning"] { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.32); }
.lesson-content.dark .lesson-callout[data-variant="warning"] .lesson-callout__head { color: #fbbf24; }

/* Suppress the global :focus-visible outline (globals.css) on the editor surface.
   Needs :focus-visible + !important to beat that rule; the editor shows its own
   cursor/active state, so the green box around the whole editor is unwanted. */
.lesson-content .ProseMirror:focus,
.lesson-content .ProseMirror:focus-visible { outline: none !important; }
.lesson-content .ProseMirror > :last-child { margin-bottom: 0; }
.lesson-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #a1a1aa; float: left; height: 0; pointer-events: none; }

.lesson-content .lesson-accordion { border: 1px solid #e4e4e7; border-radius: 10px; margin: 0.6rem 0; overflow: hidden; }
.lesson-content.dark .lesson-accordion { border-color: #2e2e33; }
.lesson-content .lesson-accordion__head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-weight: 600; font-size: 14px; background: #f8fafc; cursor: pointer; user-select: none; }
.lesson-content.dark .lesson-accordion__head { background: rgba(255,255,255,0.04); }
.lesson-content .lesson-accordion__chevron { flex-shrink: 0; transition: transform 0.18s; color: #71717a; }
.lesson-content .lesson-accordion[data-open="true"] .lesson-accordion__chevron { transform: rotate(90deg); }
.lesson-content .lesson-accordion__title { flex: 1; color: #18181b; }
.lesson-content.dark .lesson-accordion__title { color: #fafafa; }
.lesson-content .lesson-accordion__title-input { flex: 1; background: transparent; border: none; outline: none; font: inherit; font-weight: 600; color: #18181b; padding: 0; }
.lesson-content.dark .lesson-accordion__title-input { color: #fafafa; }
.lesson-content .lesson-accordion__title-input::placeholder { color: #a1a1aa; font-weight: 500; }
.lesson-content .lesson-accordion__body { padding: 10px 14px 4px 14px; }
.lesson-content .lesson-accordion__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-accordion[data-open="false"] > .lesson-accordion__body { display: none; }

.lesson-content .lesson-tabs { margin: 0.8rem 0; border: 1px solid #e4e4e7; border-radius: 10px; overflow: hidden; }
.lesson-content.dark .lesson-tabs { border-color: #2e2e33; }
.lesson-content .lesson-tabs__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 5px 6px; background: #f8fafc; border-bottom: 1px solid #e4e4e7; }
.lesson-content.dark .lesson-tabs__bar { background: rgba(255,255,255,0.04); border-bottom-color: #2e2e33; }
.lesson-content .lesson-tabs__tab { display: inline-flex; align-items: center; gap: 2px; border-radius: 7px; padding: 0 2px; }
.lesson-content .lesson-tabs__tab[data-active="true"] { background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.lesson-content.dark .lesson-tabs__tab[data-active="true"] { background: rgba(255,255,255,0.1); box-shadow: none; }
.lesson-content .lesson-tabs__tab > button { font: inherit; font-size: 13px; font-weight: 600; padding: 5px 10px; background: transparent; border: none; cursor: pointer; color: #52525b; }
.lesson-content .lesson-tabs__tab[data-active="true"] > button { color: #047857; }
.lesson-content.dark .lesson-tabs__tab > button { color: #a1a1aa; }
.lesson-content.dark .lesson-tabs__tab[data-active="true"] > button { color: #6ee7b7; }
.lesson-content .lesson-tabs__label-input { font: inherit; font-size: 13px; font-weight: 600; padding: 5px 8px; background: transparent; border: none; outline: none; color: #52525b; width: 90px; }
.lesson-content .lesson-tabs__tab[data-active="true"] .lesson-tabs__label-input { color: #047857; }
.lesson-content.dark .lesson-tabs__label-input { color: #a1a1aa; }
.lesson-content.dark .lesson-tabs__tab[data-active="true"] .lesson-tabs__label-input { color: #6ee7b7; }
.lesson-content .lesson-tabs__remove, .lesson-content .lesson-tabs__add { display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer; color: #a1a1aa; padding: 3px; border-radius: 6px; }
.lesson-content .lesson-tabs__remove:hover, .lesson-content .lesson-tabs__add:hover { background: rgba(0,0,0,0.06); color: #52525b; }
.lesson-content.dark .lesson-tabs__remove:hover, .lesson-content.dark .lesson-tabs__add:hover { background: rgba(255,255,255,0.08); color: #d4d4d8; }
.lesson-content .lesson-tabs__panels { padding: 12px 14px; }
.lesson-content .lesson-tabs__panels > .lesson-tab-panel { display: none; }
.lesson-content .lesson-tabs__panels > .lesson-tab-panel > :last-child { margin-bottom: 0; }
.lesson-content .lesson-tabs[data-active="0"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(1),
.lesson-content .lesson-tabs[data-active="1"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(2),
.lesson-content .lesson-tabs[data-active="2"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(3),
.lesson-content .lesson-tabs[data-active="3"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(4),
.lesson-content .lesson-tabs[data-active="4"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(5),
.lesson-content .lesson-tabs[data-active="5"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(6),
.lesson-content .lesson-tabs[data-active="6"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(7),
.lesson-content .lesson-tabs[data-active="7"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(8),
.lesson-content .lesson-tabs[data-active="8"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(9),
.lesson-content .lesson-tabs[data-active="9"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(10),
.lesson-content .lesson-tabs[data-active="10"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(11),
.lesson-content .lesson-tabs[data-active="11"] > .lesson-tabs__panels > .lesson-tab-panel:nth-child(12) { display: block; }
`}</style>
  );
}
