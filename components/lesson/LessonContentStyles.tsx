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
.lesson-content table[data-border-color] th, .lesson-content table[data-border-color] td { border-color: var(--lesson-table-border); }
.lesson-content table[data-border-mode="outline"] { border: 1px solid var(--lesson-table-border, #e4e4e7); }
.lesson-content.dark table[data-border-mode="outline"] { border-color: var(--lesson-table-border, #3f3f46); }
.lesson-content table[data-border-mode="outline"] th, .lesson-content table[data-border-mode="outline"] td { border: none; }
.lesson-content table[data-border-mode="minimal"] th, .lesson-content table[data-border-mode="minimal"] td { border: none; border-bottom: 1px solid var(--lesson-table-border, #e4e4e7); }
.lesson-content.dark table[data-border-mode="minimal"] th, .lesson-content.dark table[data-border-mode="minimal"] td { border-bottom-color: var(--lesson-table-border, #3f3f46); }
.lesson-content .tableWrapper { overflow-x: auto; }
.lesson-content .column-resize-handle { background: #10b981; width: 3px; pointer-events: none; }
.lesson-content .selectedCell:after { background: rgba(16,185,129,0.12); content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 2; }

.lesson-content .lesson-callout { display: flex; flex-direction: column; gap: 6px; border-radius: 10px; border: 1px solid; padding: 12px 14px; margin: 0.9rem 0; }
.lesson-content .lesson-callout__head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; user-select: none; }
.lesson-content .lesson-callout__icon { flex-shrink: 0; }
.lesson-content .lesson-callout__label { flex: 1; }
.lesson-content .lesson-callout__title-input { flex: 1; font: inherit; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: inherit; background: transparent; border: none; outline: none; padding: 0; }
.lesson-content .lesson-callout__title-input::placeholder { color: inherit; opacity: 0.55; }
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

.lesson-content .lesson-callout[data-variant="info"] { background: #eff6ff; border-color: #bfdbfe; }
.lesson-content .lesson-callout[data-variant="info"] .lesson-callout__head { color: #1d4ed8; }
.lesson-content.dark .lesson-callout[data-variant="info"] { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.32); }
.lesson-content.dark .lesson-callout[data-variant="info"] .lesson-callout__head { color: #93c5fd; }

.lesson-content .lesson-callout[data-variant="success"] { background: #f0fdf4; border-color: #bbf7d0; }
.lesson-content .lesson-callout[data-variant="success"] .lesson-callout__head { color: #15803d; }
.lesson-content.dark .lesson-callout[data-variant="success"] { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.32); }
.lesson-content.dark .lesson-callout[data-variant="success"] .lesson-callout__head { color: #86efac; }

/* Suppress the global :focus-visible outline (globals.css) on the editor surface.
   Needs :focus-visible + !important to beat that rule; the editor shows its own
   cursor/active state, so the green box around the whole editor is unwanted. */
.lesson-content .ProseMirror:focus,
.lesson-content .ProseMirror:focus-visible { outline: none !important; }
.lesson-content .ProseMirror > :last-child { margin-bottom: 0; }
.lesson-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #a1a1aa; float: left; height: 0; pointer-events: none; }

.lesson-content .lesson-accordion { margin: 0.8rem 0; }
.lesson-content .lesson-accordion__item { border: 1px solid #e4e4e7; border-radius: 10px; margin: 0.4rem 0; overflow: hidden; }
.lesson-content.dark .lesson-accordion__item { border-color: #2e2e33; }
.lesson-content .lesson-accordion__head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-weight: 600; font-size: 14px; background: #f8fafc; cursor: pointer; user-select: none; }
.lesson-content.dark .lesson-accordion__head { background: rgba(255,255,255,0.04); }
.lesson-content .lesson-accordion__chevron { flex-shrink: 0; transition: transform 0.18s; color: #71717a; }
.lesson-content .lesson-accordion__item[data-open="true"] .lesson-accordion__chevron { transform: rotate(90deg); }
.lesson-content .lesson-accordion__title { flex: 1; color: #18181b; }
.lesson-content.dark .lesson-accordion__title { color: #fafafa; }
.lesson-content .lesson-accordion__title-input { flex: 1; background: transparent; border: none; outline: none; font: inherit; font-weight: 600; color: #18181b; padding: 0; }
.lesson-content.dark .lesson-accordion__title-input { color: #fafafa; }
.lesson-content .lesson-accordion__title-input::placeholder { color: #a1a1aa; font-weight: 500; }
.lesson-content .lesson-accordion__body { padding: 10px 14px 4px 14px; }
.lesson-content .lesson-accordion__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-accordion__item[data-open="false"] > .lesson-accordion__body { display: none; }
.lesson-content .lesson-accordion__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #52525b; background: transparent; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer; }
.lesson-content .lesson-accordion__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-accordion__add { color: #a1a1aa; border-color: #3f3f46; }
.lesson-content.dark .lesson-accordion__add:hover { background: rgba(255,255,255,0.05); }
.lesson-content .lesson-accordion__controls { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; }

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
.lesson-content .lesson-tab-panel { display: none; }
.lesson-content .lesson-tab-panel > :last-child { margin-bottom: 0; }
.lesson-content .lesson-tabs[data-active="0"] .lesson-tab-panel[data-tab-index="0"],
.lesson-content .lesson-tabs[data-active="1"] .lesson-tab-panel[data-tab-index="1"],
.lesson-content .lesson-tabs[data-active="2"] .lesson-tab-panel[data-tab-index="2"],
.lesson-content .lesson-tabs[data-active="3"] .lesson-tab-panel[data-tab-index="3"],
.lesson-content .lesson-tabs[data-active="4"] .lesson-tab-panel[data-tab-index="4"],
.lesson-content .lesson-tabs[data-active="5"] .lesson-tab-panel[data-tab-index="5"],
.lesson-content .lesson-tabs[data-active="6"] .lesson-tab-panel[data-tab-index="6"],
.lesson-content .lesson-tabs[data-active="7"] .lesson-tab-panel[data-tab-index="7"],
.lesson-content .lesson-tabs[data-active="8"] .lesson-tab-panel[data-tab-index="8"],
.lesson-content .lesson-tabs[data-active="9"] .lesson-tab-panel[data-tab-index="9"],
.lesson-content .lesson-tabs[data-active="10"] .lesson-tab-panel[data-tab-index="10"],
.lesson-content .lesson-tabs[data-active="11"] .lesson-tab-panel[data-tab-index="11"] { display: block; }

.lesson-content .lesson-check { border: 1px solid #d4d4d8; border-radius: 12px; padding: 14px 16px; margin: 0.9rem 0; background: #fafafa; }
.lesson-content.dark .lesson-check { border-color: #2e2e33; background: rgba(255,255,255,0.03); }
.lesson-content .lesson-check__badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #047857; margin-bottom: 8px; }
.lesson-content.dark .lesson-check__badge { color: #6ee7b7; }
.lesson-content .lesson-check__question { font-weight: 600; color: #18181b; margin: 0 0 10px; }
.lesson-content.dark .lesson-check__question { color: #fafafa; }
.lesson-content .lesson-check__options { display: flex; flex-direction: column; gap: 7px; }
.lesson-content .lesson-check__option { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 12px; border: 1px solid #e4e4e7; border-radius: 9px; background: #ffffff; color: #3f3f46; cursor: pointer; font: inherit; font-size: 14px; transition: border-color 0.15s, background 0.15s; }
.lesson-content.dark .lesson-check__option { border-color: #3f3f46; background: rgba(255,255,255,0.02); color: #d4d4d8; }
.lesson-content .lesson-check__option:hover:not(:disabled) { border-color: #10b981; }
.lesson-content .lesson-check__option:disabled { cursor: default; }
.lesson-content .lesson-check__marker { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex-shrink: 0; border-radius: 6px; background: #f4f4f5; font-size: 11px; font-weight: 700; color: #71717a; }
.lesson-content.dark .lesson-check__marker { background: rgba(255,255,255,0.08); color: #a1a1aa; }
.lesson-content .lesson-check__option[data-correct="true"] { border-color: #10b981; background: #ecfdf5; color: #065f46; }
.lesson-content.dark .lesson-check__option[data-correct="true"] { background: rgba(16,185,129,0.12); color: #6ee7b7; }
.lesson-content .lesson-check__option[data-correct="true"] .lesson-check__marker { background: #10b981; color: #fff; }
.lesson-content .lesson-check__option[data-wrong="true"] { border-color: #f43f5e; background: #fff1f2; color: #9f1239; }
.lesson-content.dark .lesson-check__option[data-wrong="true"] { background: rgba(244,63,94,0.12); color: #fda4af; }
.lesson-content .lesson-check__option[data-wrong="true"] .lesson-check__marker { background: #f43f5e; color: #fff; }
.lesson-content .lesson-check__feedback { margin-top: 10px; }
.lesson-content .lesson-check__verdict { font-weight: 700; margin: 0 0 4px; }
.lesson-content .lesson-check[data-state="correct"] .lesson-check__verdict { color: #047857; }
.lesson-content .lesson-check[data-state="incorrect"] .lesson-check__verdict { color: #be123c; }
.lesson-content.dark .lesson-check[data-state="correct"] .lesson-check__verdict { color: #6ee7b7; }
.lesson-content.dark .lesson-check[data-state="incorrect"] .lesson-check__verdict { color: #fda4af; }
.lesson-content .lesson-check__explain { font-size: 13.5px; color: #52525b; margin: 0 0 8px; }
.lesson-content.dark .lesson-check__explain { color: #a1a1aa; }
.lesson-content .lesson-check__retry { font-size: 12px; font-weight: 600; color: #047857; background: transparent; border: none; cursor: pointer; padding: 0; }
.lesson-content.dark .lesson-check__retry { color: #6ee7b7; }
.lesson-content .lesson-check__q-input { width: 100%; font: inherit; font-weight: 600; font-size: 15px; color: #18181b; background: transparent; border: none; border-bottom: 1px solid #e4e4e7; outline: none; padding: 2px 0 6px; margin-bottom: 10px; }
.lesson-content.dark .lesson-check__q-input { color: #fafafa; border-bottom-color: #3f3f46; }
.lesson-content .lesson-check__q-input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-check__opt-edit { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.lesson-content .lesson-check__correct-toggle { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid #cbd5e1; background: transparent; color: #fff; cursor: pointer; }
.lesson-content.dark .lesson-check__correct-toggle { border-color: #52525b; }
.lesson-content .lesson-check__correct-toggle[data-correct="true"] { background: #10b981; border-color: #10b981; }
.lesson-content .lesson-check__opt-input { flex: 1; font: inherit; font-size: 14px; color: #3f3f46; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; outline: none; padding: 7px 10px; }
.lesson-content.dark .lesson-check__opt-input { color: #d4d4d8; background: rgba(255,255,255,0.02); border-color: #3f3f46; }
.lesson-content .lesson-check__opt-input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-check__opt-remove { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px; border: none; background: transparent; color: #a1a1aa; cursor: pointer; border-radius: 6px; }
.lesson-content .lesson-check__opt-remove:hover { background: rgba(0,0,0,0.06); color: #52525b; }
.lesson-content.dark .lesson-check__opt-remove:hover { background: rgba(255,255,255,0.08); color: #d4d4d8; }
.lesson-content .lesson-check__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 2px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #52525b; background: transparent; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer; }
.lesson-content .lesson-check__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-check__add { color: #a1a1aa; border-color: #3f3f46; }
.lesson-content.dark .lesson-check__add:hover { background: rgba(255,255,255,0.05); }
.lesson-content .lesson-check__explain-input { width: 100%; font: inherit; font-size: 13.5px; color: #3f3f46; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; outline: none; padding: 8px 10px; margin-top: 10px; resize: vertical; }
.lesson-content.dark .lesson-check__explain-input { color: #d4d4d8; background: rgba(255,255,255,0.02); border-color: #3f3f46; }
.lesson-content .lesson-check__explain-input::placeholder { color: #a1a1aa; }

.lesson-content .lesson-code { border: 1px solid #e4e4e7; border-radius: 10px; margin: 0.9rem 0; overflow: hidden; background: #0f1120; }
.lesson-content.dark .lesson-code { border-color: #2e2e33; }
.lesson-content .lesson-code__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #1a1d2e; border-bottom: 1px solid rgba(255,255,255,0.08); }
.lesson-content .lesson-code__lang-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #8b93a7; }
.lesson-content .lesson-code__lang { font-size: 12px; font-weight: 600; color: #c9d1d9; background: #0f1120; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 3px 6px; }
.lesson-content .lesson-code__hint { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6ee7b7; }
.lesson-content .lesson-code__hint[data-on="false"] { color: #8b93a7; font-weight: 600; text-transform: none; letter-spacing: 0; }
.lesson-content .lesson-code__actions { display: inline-flex; gap: 6px; }
.lesson-content .lesson-code__btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #c9d1d9; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 4px 10px; cursor: pointer; }
.lesson-content .lesson-code__btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.lesson-content .lesson-code__btn:disabled { opacity: 0.6; cursor: default; }
.lesson-content .lesson-code__spin { animation: lesson-code-spin 0.8s linear infinite; }
@keyframes lesson-code-spin { to { transform: rotate(360deg); } }
.lesson-content .lesson-code__editor { display: block; width: 100%; box-sizing: border-box; font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 13px; line-height: 1.5; color: #c9d1d9; background: #0f1120; border: none; outline: none; padding: 12px 14px; resize: vertical; min-height: 64px; }
.lesson-content .lesson-code__editor--run { white-space: pre; overflow-x: auto; }
.lesson-content .lesson-code__editor::placeholder { color: #5a6376; }
.lesson-content .lesson-code__setup { border-top: 1px solid rgba(255,255,255,0.08); }
.lesson-content .lesson-code__setup-label { display: block; font-size: 11px; color: #8b93a7; padding: 8px 14px 0; }
.lesson-content .lesson-code__pre { margin: 0; border-radius: 0; background: #0f1120; color: #c9d1d9; padding: 12px 14px; overflow-x: auto; }
.lesson-content .lesson-code__pre code { background: none; color: inherit; padding: 0; font-size: 13px; }
.lesson-content .lesson-code__error { font-family: "JetBrains Mono",ui-monospace,monospace; font-size: 12.5px; color: #fda4af; background: rgba(244,63,94,0.1); border-top: 1px solid rgba(244,63,94,0.25); padding: 8px 14px; white-space: pre-wrap; }
.lesson-content .lesson-code__result { background: #ffffff; border-top: 1px solid #e4e4e7; }
.lesson-content.dark .lesson-code__result { background: #141416; border-top-color: #2e2e33; }
.lesson-content .lesson-code__result-scroll { overflow: auto; max-height: 320px; }
.lesson-content .lesson-code__result table { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 0; }
.lesson-content .lesson-code__result th, .lesson-content .lesson-code__result td { border: 1px solid #e4e4e7; padding: 5px 9px; text-align: left; white-space: nowrap; color: #3f3f46; }
.lesson-content.dark .lesson-code__result th, .lesson-content.dark .lesson-code__result td { border-color: #2e2e33; color: #d4d4d8; }
.lesson-content .lesson-code__result th { background: #f4f4f5; font-weight: 600; position: sticky; top: 0; }
.lesson-content.dark .lesson-code__result th { background: #1a1d2e; }
.lesson-content .lesson-code__result-note { font-size: 11.5px; color: #71717a; padding: 6px 12px; margin: 0; }

.lesson-content .lesson-style__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 8px; border-radius: 8px; background: rgba(0,0,0,0.04); }
.lesson-content.dark .lesson-style__bar { background: rgba(255,255,255,0.06); }
.lesson-content .lesson-style__seg { display: inline-flex; gap: 2px; }
.lesson-content .lesson-style__seg button { font-size: 11px; font-weight: 600; padding: 3px 8px; border: 1px solid transparent; border-radius: 6px; background: rgba(0,0,0,0.05); color: #52525b; cursor: pointer; }
.lesson-content.dark .lesson-style__seg button { background: rgba(255,255,255,0.08); color: #a1a1aa; }
.lesson-content .lesson-style__seg button[data-active="true"] { background: #10b981; color: #fff; }
.lesson-content .lesson-style__color { display: inline-flex; align-items: center; gap: 4px; }
.lesson-content .lesson-style__color input[type="color"] { width: 26px; height: 22px; padding: 0; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; background: none; cursor: pointer; }
.lesson-content.dark .lesson-style__color input[type="color"] { border-color: rgba(255,255,255,0.2); }
.lesson-content .lesson-style__color-reset { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: #a1a1aa; cursor: pointer; border-radius: 5px; }
.lesson-content .lesson-style__color-reset:hover { background: rgba(0,0,0,0.06); color: #52525b; }
.lesson-content.dark .lesson-style__color-reset:hover { background: rgba(255,255,255,0.08); }
.lesson-content .lesson-style__label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; }

.lesson-content .lesson-image { margin: 0.9rem 0; }
.lesson-content .lesson-image > img { display: block; height: auto; margin: 0; box-sizing: border-box; }
.lesson-content .lesson-image__caption { font-size: 12.5px; color: #71717a; margin-top: 6px; }
.lesson-content.dark .lesson-image__caption { color: #a1a1aa; }
.lesson-content .lesson-image__caption-input { width: 100%; max-width: 520px; margin-top: 6px; font: inherit; font-size: 12.5px; text-align: center; color: #71717a; background: transparent; border: none; border-bottom: 1px dashed #d4d4d8; outline: none; padding: 2px 0; }
.lesson-content.dark .lesson-image__caption-input { color: #a1a1aa; border-bottom-color: #3f3f46; }
.lesson-content .lesson-image__caption-input::placeholder { color: #c4c4c8; }
.lesson-content .lesson-image__alt-input { font: inherit; font-size: 11px; width: 110px; padding: 3px 7px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.02); color: #52525b; outline: none; }
.lesson-content.dark .lesson-image__alt-input { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #d4d4d8; }
`}</style>
  );
}
