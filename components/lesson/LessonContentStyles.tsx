'use client';

// Shared stylesheet for interactive lesson content. Both LessonEditor (authoring)
// and LessonRenderer (player) wrap their content in `.lesson-content` (plus `.dark`
// in dark mode), so this single stylesheet themes both surfaces identically and the
// React node views never need theme props. Rendering it twice is harmless.
//
// Palette stays within the platform guardrails: neutral / emerald / amber only.
// No indigo, purple, or blue accents.

export function LessonContentStyles() {
  // Stepper progressive reveal: when N steps are revealed, show steps 0..N-1. Generated
  // (rather than hand-written) so the cumulative selectors don't bloat the source.
  const stepReveal = Array.from({ length: 12 }, (_, r) => {
    const revealed = r + 1;
    const show = Array.from({ length: revealed }, (_, i) =>
      `.lesson-content .lesson-stepper[data-revealed="${revealed}"] .lesson-step[data-step-index="${i}"]`,
    ).join(',\n');
    // Only the newest revealed step (index revealed-1) animates in -- already-shown
    // steps match a rule with no animation, so they don't re-play on each reveal. It
    // also has no connector below it (would dangle into empty space).
    const last = `.lesson-content .lesson-stepper[data-revealed="${revealed}"] .lesson-step[data-step-index="${revealed - 1}"]`;
    return `${show} { display: flex; }\n${last} { animation: lesson-step-in 0.34s cubic-bezier(0.2,0.7,0.3,1); }\n${last}::after { display: none; }`;
  }).join('\n');
  return (
    <style>{`
.lesson-content { font-size: 15.5px; line-height: 1.6; color: #3f3f46; }
.lesson-content.dark { color: #d4d4d8; }
/* Brand accent for decorative interactive chrome (timeline dot, stepper marker/line/
   button, carousel check, glossary underline). --lesson-accent-base is set from the
   tenant primary color on the .lesson-content container (default emerald), and the
   shades are derived from it with color-mix so they track any theme. Semantic colors
   (correct=green, callout variants, etc.) intentionally stay fixed. */
.lesson-content { --lesson-accent-base: #10b981; --lesson-accent: var(--lesson-accent-base); --lesson-accent-ink: color-mix(in oklab, var(--lesson-accent) 80%, #000); --lesson-accent-ring: color-mix(in oklab, var(--lesson-accent) 22%, transparent); --lesson-accent-strong: color-mix(in oklab, var(--lesson-accent) 85%, #000); }
.lesson-content.dark { --lesson-accent: color-mix(in oklab, var(--lesson-accent-base) 85%, #fff); --lesson-accent-ink: color-mix(in oklab, var(--lesson-accent) 70%, #fff); }
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
.lesson-content pre { font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 0.85em; background: #f6f8fa; color: #1a1d2e; border: 1px solid #d0d7de; border-radius: 8px; padding: 12px 16px; margin: 0.75rem 0; overflow-x: auto; white-space: pre; }
.lesson-content.dark pre { background: #0f1120; color: #c9d1d9; border-color: #2e2e33; }
.lesson-content pre code { background: none; padding: 0; border-radius: 0; color: inherit; font-size: inherit; }
/* Dark block-code reset must out-specify .lesson-content.dark code (two classes), or
   inline-code green/background leaks onto block code inside <pre> in dark mode. */
.lesson-content.dark pre code { background: none; color: inherit; }

.lesson-content blockquote { border-left: 3px solid #10b981; padding-left: 0.875rem; margin: 0.75rem 0; color: #52525b; font-style: normal; }
.lesson-content.dark blockquote { color: #a1a1aa; }

.lesson-content img { max-width: 100%; height: auto; border-radius: 10px; margin: 0.75rem 0; display: block; }
.lesson-content img.ProseMirror-selectednode { outline: 2px solid #10b981; outline-offset: 2px; }

.lesson-content table { border-collapse: collapse; width: 100%; margin: 0.9rem 0; font-size: 0.95em; overflow: hidden; }
.lesson-content th, .lesson-content td { border: 1px solid #e4e4e7; padding: 7px 11px; text-align: left; vertical-align: top; }
.lesson-content th { background: #f4f4f5; font-weight: 600; color: #18181b; }
.lesson-content.dark th, .lesson-content.dark td { border-color: #3f3f46; }
.lesson-content.dark th { background: rgba(255,255,255,0.05); color: #fafafa; }
.lesson-content td[data-cb], .lesson-content th[data-cb] { border-color: var(--cbc, #e4e4e7); }
.lesson-content.dark td[data-cb], .lesson-content.dark th[data-cb] { border-color: var(--cbc, #3f3f46); }
.lesson-content td[data-cb="none"], .lesson-content th[data-cb="none"] { border: 0; }
.lesson-content td[data-cb="all"], .lesson-content th[data-cb="all"] { border-width: 1px; border-style: solid; }
.lesson-content td[data-cb="horizontal"], .lesson-content th[data-cb="horizontal"] { border-width: 1px 0; border-style: solid; }
.lesson-content td[data-cb="vertical"], .lesson-content th[data-cb="vertical"] { border-width: 0 1px; border-style: solid; }
.lesson-content .tableWrapper { overflow-x: auto; container-type: inline-size; }
/* Narrow column: keep columns readable and let the table scroll sideways instead of crushing every cell to a few characters. Keyed to the wrapper's own width. */
@container (max-width: 560px) { .lesson-content th, .lesson-content td { min-width: 7.5rem; } }
.lesson-content .column-resize-handle { background: #10b981; width: 3px; pointer-events: none; }
.lesson-content .selectedCell:after { background: rgba(16,185,129,0.12); content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 2; }

.lesson-content .lesson-callout { --callout-accent: var(--lesson-accent); --callout-ink: var(--lesson-accent-ink); --callout-surface: color-mix(in oklab, var(--callout-accent) 5%, #ffffff); --callout-border: color-mix(in oklab, var(--callout-accent) 18%, #e2e8f0); position: relative; display: grid; grid-template-columns: 38px minmax(0,1fr); gap: 12px; overflow: hidden; margin: 1rem 0; padding: 16px 17px 16px 14px; border: 0; border-radius: 15px; color: #3f3f46; background: var(--callout-surface); box-shadow: 0 8px 24px rgba(15,23,42,0.045); }
.lesson-content .lesson-callout::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--callout-accent); }
.lesson-content.dark .lesson-callout { --callout-surface: rgba(255,255,255,0.035); --callout-border: color-mix(in oklab, var(--callout-accent) 24%, rgba(255,255,255,0.08)); color: #d4d4d8; box-shadow: none; }
.lesson-content .lesson-callout__icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 11px; color: var(--callout-ink); background: color-mix(in oklab, var(--callout-accent) 12%, transparent); }
.lesson-content.dark .lesson-callout__icon-wrap { color: color-mix(in oklab, var(--callout-accent) 60%, #fff); background: color-mix(in oklab, var(--callout-accent) 15%, transparent); }
.lesson-content .lesson-callout__icon { flex: 0 0 auto; }
.lesson-content .lesson-callout__main { min-width: 0; }
.lesson-content .lesson-callout__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 36px; margin-bottom: 5px; user-select: none; }
.lesson-content .lesson-callout__heading { min-width: 0; flex: 1; }
.lesson-content .lesson-callout__eyebrow { display: block; color: var(--callout-ink); font-size: 9.5px; font-weight: 800; letter-spacing: 0.13em; line-height: 1.45; text-transform: uppercase; }
.lesson-content.dark .lesson-callout__eyebrow { color: color-mix(in oklab, var(--callout-accent) 60%, #fff); }
.lesson-content .lesson-callout__title { margin: 2px 0 0; color: #18181b; font-size: 14.5px; font-weight: 740; letter-spacing: -0.005em; line-height: 1.4; }
.lesson-content.dark .lesson-callout__title { color: #fafafa; }
.lesson-content .lesson-callout__title-input { display: block; width: 100%; margin-top: 1px; padding: 1px 0; border: 0; border-bottom: 1px dashed color-mix(in oklab, var(--callout-accent) 20%, #d4d4d8); outline: 0; color: #18181b; background: transparent; font: inherit; font-size: 14.5px; font-weight: 740; line-height: 1.4; }
.lesson-content.dark .lesson-callout__title-input { color: #fafafa; border-bottom-color: rgba(255,255,255,0.13); }
.lesson-content .lesson-callout__title-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-callout__body { color: inherit; }
.lesson-content .lesson-callout__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-callout__controls { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; transition: opacity 0.15s ease; }
.lesson-content .lesson-callout__control { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; padding: 0; border: 0; border-radius: 7px; color: #a1a1aa; background: transparent; cursor: pointer; }
.lesson-content .lesson-callout__control:hover { color: var(--callout-ink); background: color-mix(in oklab, var(--callout-accent) 10%, transparent); }
.lesson-content .lesson-callout__remove:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
@media (hover: hover) {
  .lesson-content .lesson-callout__controls { opacity: 0; }
  .lesson-content .lesson-callout:hover .lesson-callout__controls, .lesson-content .lesson-callout:focus-within .lesson-callout__controls { opacity: 1; }
}
.lesson-content .lesson-callout__add-action { display: inline-flex; align-items: center; gap: 5px; margin-top: 9px; padding: 4px 7px; border: 0; border-radius: 7px; color: var(--callout-ink); background: transparent; cursor: pointer; font: inherit; font-size: 11px; font-weight: 680; }
.lesson-content .lesson-callout__add-action:hover { background: color-mix(in oklab, var(--callout-accent) 10%, transparent); }
.lesson-content .lesson-callout__action-editor { display: grid; grid-template-columns: minmax(90px,0.7fr) minmax(150px,1.3fr) 24px; gap: 7px; align-items: center; margin-top: 10px; padding: 8px; border-radius: 9px; background: rgba(255,255,255,0.62); }
.lesson-content.dark .lesson-callout__action-editor { background: rgba(255,255,255,0.045); }
.lesson-content .lesson-callout__action-input { min-width: 0; width: 100%; padding: 5px 7px; border: 1px solid rgba(15,23,42,0.09); border-radius: 7px; outline: 0; color: #27272a; background: rgba(255,255,255,0.78); font: inherit; font-size: 10.5px; }
.lesson-content.dark .lesson-callout__action-input { border-color: rgba(255,255,255,0.09); color: #e4e4e7; background: rgba(255,255,255,0.035); }
.lesson-content .lesson-callout__action-input:focus { border-color: var(--callout-accent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--callout-accent) 14%, transparent); }
.lesson-content .lesson-callout__remove-action { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; color: #a1a1aa; background: transparent; cursor: pointer; }
.lesson-content .lesson-callout__remove-action:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
.lesson-content .lesson-callout__action { display: inline-flex; align-items: center; gap: 5px; width: fit-content; margin-top: 10px; padding: 6px 9px; border-radius: 8px; color: var(--callout-ink); background: color-mix(in oklab, var(--callout-accent) 10%, transparent); text-decoration: none; font-size: 11px; font-weight: 720; }
.lesson-content .lesson-callout__action:hover { opacity: 1; background: color-mix(in oklab, var(--callout-accent) 16%, transparent); }

.lesson-content .lesson-callout[data-variant="tip"] { --callout-accent: #10b981; --callout-ink: #047857; }
.lesson-content .lesson-callout[data-variant="warning"] { --callout-accent: #f59e0b; --callout-ink: #a16207; }
.lesson-content .lesson-callout[data-variant="info"] { --callout-accent: #3b82f6; --callout-ink: #1d4ed8; }
.lesson-content .lesson-callout[data-variant="success"] { --callout-accent: #22c55e; --callout-ink: #15803d; }
@media (max-width: 560px) {
  .lesson-content .lesson-callout { grid-template-columns: 32px minmax(0,1fr); gap: 10px; padding: 13px 13px 13px 11px; border-radius: 13px; }
  .lesson-content .lesson-callout__icon-wrap { width: 32px; height: 32px; border-radius: 9px; }
  .lesson-content .lesson-callout__action-editor { grid-template-columns: 1fr 24px; }
  .lesson-content .lesson-callout__action-editor .lesson-callout__action-input:first-child { grid-column: 1; }
  .lesson-content .lesson-callout__action-editor .lesson-callout__action-input:nth-child(2) { grid-column: 1; }
  .lesson-content .lesson-callout__remove-action { grid-column: 2; grid-row: 1 / span 2; }
}

/* Suppress the global :focus-visible outline (globals.css) on the editor surface.
   Needs :focus-visible + !important to beat that rule; the editor shows its own
   cursor/active state, so the green box around the whole editor is unwanted. */
.lesson-content .ProseMirror:focus,
.lesson-content .ProseMirror:focus-visible { outline: none !important; }
.lesson-content .ProseMirror > :last-child { margin-bottom: 0; }
.lesson-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #a1a1aa; float: left; height: 0; pointer-events: none; }

.lesson-content .lesson-accordion { margin: 1rem 0; --acc-border-default: #e2e8f0; }
.lesson-content.dark .lesson-accordion { --acc-border-default: rgba(255,255,255,0.09); }
.lesson-content .lesson-accordion__toolbar { display: flex; justify-content: flex-end; margin-bottom: 7px; }
.lesson-content .lesson-accordion__items { overflow: hidden; border-style: var(--acc-border-style, solid); border-width: var(--acc-border-width, 1px); border-color: var(--acc-border-color, var(--acc-border-default, #e2e8f0)); border-radius: 16px; background: #ffffff; box-shadow: 0 8px 24px rgba(15,23,42,0.045); }
.lesson-content.dark .lesson-accordion__items { background: rgba(255,255,255,0.025); box-shadow: none; }
.lesson-content .lesson-accordion__items > [data-node-view-content-react] { display: flex; flex-direction: column; }
.lesson-content .lesson-accordion__items > [data-node-view-content-react] > .node-accordionItem + .node-accordionItem { border-top: 1px solid var(--acc-border-color, var(--acc-border-default, #e2e8f0)); }
.lesson-content .lesson-accordion__item { position: relative; overflow: hidden; background: transparent; }
.lesson-content .lesson-accordion__item::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; z-index: 2; background: var(--lesson-accent); opacity: 0; transform: scaleY(0.45); transform-origin: center; transition: opacity 0.2s ease, transform 0.2s ease; }
.lesson-content .lesson-accordion__item[data-open="true"]::before { opacity: 1; transform: scaleY(1); }
.lesson-content .lesson-accordion__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; min-height: 62px; margin: 0; padding: 15px 18px 15px 20px; border: 0; border-radius: 0; color: #18181b; background: transparent; cursor: pointer; user-select: none; text-align: left; font: inherit; font-size: 15px; font-weight: 720; line-height: 1.35; transition: background 0.16s ease, color 0.16s ease; }
.lesson-content .lesson-accordion__head:hover { background: color-mix(in oklab, var(--lesson-accent-base) 4%, transparent); }
.lesson-content .lesson-accordion__head:focus-visible { position: relative; z-index: 3; outline: 2px solid var(--lesson-accent) !important; outline-offset: -3px; }
.lesson-content.dark .lesson-accordion__head { color: #f4f4f5; }
.lesson-content.dark .lesson-accordion__head:hover { background: rgba(255,255,255,0.035); }
.lesson-content .lesson-accordion__title { flex: 1; color: inherit; }
.lesson-content .lesson-accordion__title-input { flex: 1; min-width: 0; padding: 2px 0; border: none; outline: none; color: inherit; background: transparent; font: inherit; font-weight: 720; }
.lesson-content .lesson-accordion__title-input::placeholder { color: #a1a1aa; font-weight: 550; }
.lesson-content .lesson-accordion__editor-toggle { display: inline-flex; flex: 0 0 auto; padding: 0; border: 0; border-radius: 9px; color: inherit; background: transparent; cursor: pointer; }
.lesson-content .lesson-accordion__toggle-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 9px; color: #71717a; transition: color 0.16s ease, background 0.16s ease; }
.lesson-content .lesson-accordion__head:hover .lesson-accordion__toggle-icon, .lesson-content .lesson-accordion__editor-toggle:hover .lesson-accordion__toggle-icon { color: var(--lesson-accent-ink); background: var(--lesson-accent-ring); }
.lesson-content.dark .lesson-accordion__toggle-icon { color: #a1a1aa; }
.lesson-content .lesson-accordion__plus, .lesson-content .lesson-accordion__minus { position: absolute; transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.2,0.7,0.3,1); }
.lesson-content .lesson-accordion__minus { opacity: 0; transform: rotate(-90deg) scale(0.7); }
.lesson-content .lesson-accordion__item[data-open="true"] .lesson-accordion__plus { opacity: 0; transform: rotate(90deg) scale(0.7); }
.lesson-content .lesson-accordion__item[data-open="true"] .lesson-accordion__minus { opacity: 1; transform: rotate(0) scale(1); }
.lesson-content .lesson-accordion__body-shell { display: grid; grid-template-rows: 1fr; opacity: 1; transition: grid-template-rows 0.24s cubic-bezier(0.2,0.7,0.3,1), opacity 0.18s ease; }
.lesson-content .lesson-accordion__body { min-height: 0; overflow: hidden; padding: 2px 20px 20px; color: #52525b; }
.lesson-content.dark .lesson-accordion__body { color: #b4b4bc; }
.lesson-content .lesson-accordion__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-accordion__item[data-open="false"] > .lesson-accordion__body-shell { grid-template-rows: 0fr; opacity: 0; }
.lesson-content .lesson-accordion__item[data-open="false"] .lesson-accordion__body { padding-top: 0; padding-bottom: 0; }
.lesson-content .lesson-accordion__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; padding: 6px 10px; border: 0; border-radius: 8px; color: var(--lesson-accent-ink); background: transparent; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
.lesson-content .lesson-accordion__add:hover { background: var(--lesson-accent-ring); }
@media (max-width: 560px) {
  .lesson-content .lesson-accordion__items { border-radius: 13px; }
  .lesson-content .lesson-accordion__head { min-height: 56px; padding: 13px 13px 13px 16px; font-size: 14px; }
  .lesson-content .lesson-accordion__body { padding: 1px 16px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .lesson-content .lesson-accordion__item::before, .lesson-content .lesson-accordion__plus, .lesson-content .lesson-accordion__minus, .lesson-content .lesson-accordion__body-shell { transition: none; }
}

.lesson-content .lesson-tabs { --tabs-border: #e2e8f0; overflow: hidden; margin: 1rem 0; border: 0; border-radius: 16px; background: #ffffff; box-shadow: 0 8px 24px rgba(15,23,42,0.05); }
.lesson-content.dark .lesson-tabs { --tabs-border: rgba(255,255,255,0.09); background: rgba(255,255,255,0.03); box-shadow: none; }
.lesson-content .lesson-tabs__bar { display: flex; flex-wrap: nowrap; align-items: center; gap: 4px; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: none; padding: 7px; background: #f4f4f5; }
.lesson-content .lesson-tabs__bar::-webkit-scrollbar { display: none; }
.lesson-content.dark .lesson-tabs__bar { background: rgba(255,255,255,0.04); }
.lesson-content .lesson-tabs__style { position: sticky; right: 0; display: inline-flex; align-items: center; flex: 0 0 auto; margin-left: auto; padding-left: 4px; background: #f4f4f5; box-shadow: -8px 0 10px #f4f4f5; }
.lesson-content.dark .lesson-tabs__style { background: #242428; box-shadow: -8px 0 10px #242428; }
.lesson-content .lesson-tabs__tab { position: relative; display: inline-flex; align-items: center; gap: 1px; min-height: 34px; flex: 0 0 auto; padding: 2px; border-radius: 10px; color: #71717a; transition: color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease; }
.lesson-content .lesson-tabs__tab::after { content: ''; position: absolute; left: 50%; bottom: 2px; width: 16px; height: 2px; border-radius: 999px; background: var(--lesson-accent); opacity: 0; transform: translateX(-50%) scaleX(0.4); transition: opacity 0.18s ease, transform 0.2s ease; }
.lesson-content .lesson-tabs__tab[data-active="true"] { color: var(--lesson-accent-ink); background: #ffffff; box-shadow: 0 2px 7px rgba(15,23,42,0.08); }
.lesson-content .lesson-tabs__tab[data-active="true"]::after { opacity: 1; transform: translateX(-50%) scaleX(1); }
.lesson-content.dark .lesson-tabs__tab { color: #a1a1aa; }
.lesson-content.dark .lesson-tabs__tab[data-active="true"] { color: var(--lesson-accent-ink); background: rgba(255,255,255,0.1); box-shadow: none; }
.lesson-content .lesson-tabs__trigger { min-height: 28px; padding: 5px 10px 7px; border: 0; border-radius: 8px; color: inherit; background: transparent; cursor: pointer; white-space: nowrap; font: inherit; font-size: 12.5px; font-weight: 680; }
.lesson-content .lesson-tabs__trigger:focus-visible { outline: 2px solid var(--lesson-accent) !important; outline-offset: 1px; }
.lesson-content .lesson-tabs__label-input { width: 96px; min-width: 58px; padding: 5px 7px 7px; border: 0; outline: 0; color: inherit; background: transparent; font: inherit; font-size: 12.5px; font-weight: 680; }
.lesson-content .lesson-tabs__label-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-tabs__remove, .lesson-content .lesson-tabs__add { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; flex: 0 0 25px; padding: 0; border: 0; border-radius: 7px; color: #a1a1aa; background: transparent; cursor: pointer; }
.lesson-content .lesson-tabs__remove:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
.lesson-content .lesson-tabs__add:hover { color: var(--lesson-accent-ink); background: var(--lesson-accent-ring); }
.lesson-content .lesson-tabs__panels { min-height: 84px; padding: 18px 20px 20px; }
.lesson-content .lesson-tab-panel { display: none; color: #52525b; }
.lesson-content.dark .lesson-tab-panel { color: #c4c4cc; }
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
.lesson-content .lesson-tabs[data-active="11"] .lesson-tab-panel[data-tab-index="11"] { display: block; animation: lesson-tab-panel-in 0.2s cubic-bezier(0.2,0.7,0.3,1); }
@keyframes lesson-tab-panel-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 560px) {
  .lesson-content .lesson-tabs { border-radius: 13px; }
  .lesson-content .lesson-tabs__bar { padding: 6px; }
  .lesson-content .lesson-tabs__panels { min-height: 72px; padding: 15px 16px 17px; }
}
@media (prefers-reduced-motion: reduce) {
  .lesson-content .lesson-tabs__tab, .lesson-content .lesson-tabs__tab::after, .lesson-content .lesson-tab-panel { animation: none; transition: none; }
}

.lesson-content .lesson-check { border: 1px solid #d4d4d8; border-radius: 12px; padding: 14px 16px; margin: 0.9rem 0; background: #fafafa; }
.lesson-content.dark .lesson-check { border-color: #2e2e33; background: rgba(255,255,255,0.03); }
.lesson-content .lesson-check__badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #047857; margin-bottom: 8px; }
.lesson-content.dark .lesson-check__badge { color: #6ee7b7; }
.lesson-content .lesson-check__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.lesson-content .lesson-check__bar .lesson-check__badge { margin-bottom: 0; }
.lesson-content .lesson-check__question { font-weight: 600; color: #18181b; margin: 0 0 10px; }
.lesson-content.dark .lesson-check__question { color: #fafafa; }
.lesson-content .lesson-check__options { display: flex; flex-direction: column; gap: 7px; }
.lesson-content .lesson-check__option { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 12px; border: none; border-radius: 9px; background: #ffffff; color: #3f3f46; cursor: pointer; font: inherit; font-size: 14px; transition: background 0.15s, color 0.15s; }
.lesson-content.dark .lesson-check__option { background: rgba(255,255,255,0.05); color: #d4d4d8; }
.lesson-content .lesson-check__option:hover:not(:disabled) { background: #ecfdf5; color: #065f46; }
.lesson-content.dark .lesson-check__option:hover:not(:disabled) { background: rgba(16,185,129,0.12); color: #6ee7b7; }
.lesson-content .lesson-check__option:disabled { cursor: default; }
.lesson-content .lesson-check__opt-text { flex: 1; }
.lesson-content .lesson-check__opt-end { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lesson-content .lesson-check__num { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: #a1a1aa; }
.lesson-content.dark .lesson-check__num { color: #71717a; }
.lesson-content .lesson-check__option[data-correct="true"] { background: #d1fae5; color: #065f46; font-weight: 600; }
.lesson-content.dark .lesson-check__option[data-correct="true"] { background: rgba(16,185,129,0.22); color: #6ee7b7; font-weight: 600; }
.lesson-content .lesson-check__option[data-correct="true"] .lesson-check__num, .lesson-content .lesson-check__option[data-correct="true"] .lesson-check__icon { color: #10b981; }
.lesson-content.dark .lesson-check__option[data-correct="true"] .lesson-check__num, .lesson-content.dark .lesson-check__option[data-correct="true"] .lesson-check__icon { color: #34d399; }
.lesson-content .lesson-check__option[data-wrong="true"] { background: #fee2e2; color: #9f1239; font-weight: 600; }
.lesson-content.dark .lesson-check__option[data-wrong="true"] { background: rgba(244,63,94,0.22); color: #fda4af; font-weight: 600; }
.lesson-content .lesson-check__option[data-wrong="true"] .lesson-check__num, .lesson-content .lesson-check__option[data-wrong="true"] .lesson-check__icon { color: #f43f5e; }
.lesson-content.dark .lesson-check__option[data-wrong="true"] .lesson-check__num, .lesson-content.dark .lesson-check__option[data-wrong="true"] .lesson-check__icon { color: #fb7185; }
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
@keyframes lesson-check-iconpop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
.lesson-content .lesson-check__icon { animation: lesson-check-iconpop 0.28s cubic-bezier(0.2,0.8,0.2,1.5); }
.lesson-check__toast { position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 2000; display: inline-flex; align-items: center; gap: 9px; padding: 12px 20px; border-radius: 999px; background: #10b981; color: #fff; font-size: 14px; font-weight: 700; box-shadow: 0 12px 32px rgba(0,0,0,0.28); animation: lesson-check-toastpop 0.32s cubic-bezier(0.2,0.8,0.2,1.4); }
.lesson-check__toast-emoji { font-size: 18px; line-height: 1; }
@keyframes lesson-check-toastpop { from { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.92); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .lesson-check__toast, .lesson-content .lesson-check__icon { animation: none; } }
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

.lesson-content .lesson-code { border: 1px solid #e4e4e7; border-radius: 10px; margin: 0.9rem 0; overflow: hidden; background: #f6f8fa; }
.lesson-content.dark .lesson-code { border-color: #2e2e33; background: #0f1120; }
.lesson-content .lesson-code__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #eef1f5; border-bottom: 1px solid #e4e4e7; }
.lesson-content.dark .lesson-code__bar { background: #1a1d2e; border-bottom-color: rgba(255,255,255,0.08); }
.lesson-content .lesson-code__lang-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #57606a; }
.lesson-content.dark .lesson-code__lang-label { color: #8b93a7; }
.lesson-content .lesson-code__lang { font-size: 12px; font-weight: 600; color: #1f2328; background: #ffffff; border: 1px solid #d0d7de; border-radius: 6px; padding: 3px 6px; }
.lesson-content.dark .lesson-code__lang { color: #c9d1d9; background: #0f1120; border-color: rgba(255,255,255,0.12); }
.lesson-content .lesson-code__hint { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #047857; }
.lesson-content.dark .lesson-code__hint { color: #6ee7b7; }
.lesson-content .lesson-code__bar-right { display: inline-flex; align-items: center; gap: 10px; }
.lesson-content .lesson-code__scope { display: inline-flex; gap: 2px; padding: 2px; border-radius: 7px; background: rgba(0,0,0,0.06); }
.lesson-content.dark .lesson-code__scope { background: rgba(255,255,255,0.08); }
.lesson-content .lesson-code__scope button { font: inherit; font-size: 11px; font-weight: 600; padding: 2px 8px; border: none; border-radius: 5px; background: transparent; color: #57606a; cursor: pointer; }
.lesson-content.dark .lesson-code__scope button { color: #8b93a7; }
.lesson-content .lesson-code__scope button[data-active="true"] { background: #ffffff; color: #1f2328; box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
.lesson-content.dark .lesson-code__scope button[data-active="true"] { background: #0f1120; color: #c9d1d9; box-shadow: none; }
.lesson-content .lesson-code__hint[data-on="false"] { color: #6e7781; font-weight: 600; text-transform: none; letter-spacing: 0; }
.lesson-content.dark .lesson-code__hint[data-on="false"] { color: #8b93a7; }
.lesson-content .lesson-code__actions { display: inline-flex; gap: 6px; }
.lesson-content .lesson-code__btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #1f2328; background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.12); border-radius: 7px; padding: 4px 10px; cursor: pointer; }
.lesson-content.dark .lesson-code__btn { color: #c9d1d9; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
.lesson-content .lesson-code__btn:hover:not(:disabled) { background: rgba(0,0,0,0.09); }
.lesson-content.dark .lesson-code__btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.lesson-content .lesson-code__btn:disabled { opacity: 0.6; cursor: default; }
.lesson-content .lesson-code__btn[data-active="true"] { background: rgba(16,185,129,0.14); color: #047857; }
.lesson-content.dark .lesson-code__btn[data-active="true"] { background: rgba(16,185,129,0.2); color: #6ee7b7; }
/* Dataset preview popover ("Available data") -- portaled to <body>, so it floats over
   the lesson and is never clipped. Carries the lesson-content class so the scoped result
   table styles (incl. the perimeter-border fix) apply inside it. */
.lesson-data-pop { z-index: 1000; max-height: 62vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 11px; border-radius: 12px; background: #ffffff; border: 1px solid #e4e4e7; box-shadow: 0 12px 32px rgba(0,0,0,0.18); font-size: 13px; color: #3f3f46; }
.lesson-data-pop.dark { background: #1c1c20; border-color: #2e2e33; color: #d4d4d8; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }
.lesson-data-pop__head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
.lesson-data-pop__head button { display: inline-flex; padding: 2px; border: none; background: transparent; color: #a1a1aa; cursor: pointer; border-radius: 5px; }
.lesson-data-pop__head button:hover { background: rgba(0,0,0,0.06); color: #52525b; }
.lesson-data-pop.dark .lesson-data-pop__head button:hover { background: rgba(255,255,255,0.08); color: #d4d4d8; }
.lesson-data-pop__tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.lesson-data-pop__tabs button { font: inherit; font-family: "JetBrains Mono",ui-monospace,monospace; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border: none; border-radius: 999px; background: rgba(0,0,0,0.05); color: #52525b; cursor: pointer; }
.lesson-data-pop.dark .lesson-data-pop__tabs button { background: rgba(255,255,255,0.08); color: #a1a1aa; }
.lesson-data-pop__tabs button[data-active="true"] { background: #10b981; color: #fff; }
.lesson-data-pop__meta { display: flex; align-items: baseline; gap: 8px; font-size: 11px; color: #71717a; }
.lesson-data-pop__meta strong { font-family: "JetBrains Mono",ui-monospace,monospace; font-size: 12px; color: #18181b; }
.lesson-data-pop.dark .lesson-data-pop__meta strong { color: #fafafa; }
.lesson-data-pop__note { font-size: 12px; color: #71717a; margin: 2px 0; }
.lesson-data-pop .lesson-code__result { border: 1px solid #e4e4e7; border-radius: 6px; overflow: hidden; }
.lesson-data-pop.dark .lesson-code__result { border-color: #2e2e33; }
.lesson-content .lesson-code__spin { animation: lesson-code-spin 0.8s linear infinite; }
@keyframes lesson-code-spin { to { transform: rotate(360deg); } }
.lesson-content .lesson-code__editor { display: block; width: 100%; box-sizing: border-box; font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 13px; line-height: 1.5; color: #1f2328; background: #f6f8fa; border: none; outline: none; padding: 12px 14px; resize: vertical; min-height: 64px; }
.lesson-content.dark .lesson-code__editor { color: #c9d1d9; background: #0f1120; }
.lesson-content .lesson-code__editor--run { white-space: pre; overflow-x: auto; }
.lesson-content .lesson-code__editor::placeholder { color: #8c959f; }
.lesson-content.dark .lesson-code__editor::placeholder { color: #5a6376; }
.lesson-content .lesson-code__setup { border-top: 1px solid #e4e4e7; }
.lesson-content.dark .lesson-code__setup { border-top-color: rgba(255,255,255,0.08); }
.lesson-content .lesson-code__setup-label { display: block; font-size: 11px; color: #57606a; padding: 8px 14px 0; }
.lesson-content.dark .lesson-code__setup-label { color: #8b93a7; }
.lesson-content .lesson-code__pre { margin: 0; border-radius: 0; background: #f6f8fa; color: #1f2328; padding: 12px 14px; overflow-x: auto; }
.lesson-content.dark .lesson-code__pre { background: #0f1120; color: #c9d1d9; }
.lesson-content .lesson-code__pre code { background: none; color: inherit; padding: 0; font-size: 13px; }
.lesson-content .lesson-code__error { font-family: "JetBrains Mono",ui-monospace,monospace; font-size: 12.5px; color: #b42318; background: #fef2f2; border-top: 1px solid #fecdca; padding: 8px 14px; white-space: pre-wrap; }
.lesson-content.dark .lesson-code__error { color: #fda4af; background: rgba(244,63,94,0.1); border-top-color: rgba(244,63,94,0.25); }
.lesson-content .lesson-code__result { background: #ffffff; border-top: 1px solid #e4e4e7; }
.lesson-content.dark .lesson-code__result { background: #141416; border-top-color: #2e2e33; }
.lesson-content .lesson-code__result-scroll { overflow: auto; max-height: 320px; }
.lesson-content .lesson-code__result table { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 0; }
.lesson-content .lesson-code__result th, .lesson-content .lesson-code__result td { border: 1px solid #e4e4e7; padding: 5px 9px; text-align: left; white-space: nowrap; color: #3f3f46; }
.lesson-content.dark .lesson-code__result th, .lesson-content.dark .lesson-code__result td { border-color: #2e2e33; color: #d4d4d8; }
.lesson-content .lesson-code__result th { background: #f4f4f5; font-weight: 600; position: sticky; top: 0; }
.lesson-content.dark .lesson-code__result th { background: #1a1d2e; }
/* Drop the table's perimeter borders so they don't double up against the block's own
   container border -- keep only the internal gridlines. */
.lesson-content .lesson-code__result table tr > :first-child { border-left: none; }
.lesson-content .lesson-code__result table tr > :last-child { border-right: none; }
.lesson-content .lesson-code__result thead tr:first-child > * { border-top: none; }
.lesson-content .lesson-code__result tbody tr:last-child > * { border-bottom: none; }
.lesson-content .lesson-code__result-note { font-size: 11.5px; color: #71717a; padding: 6px 12px; margin: 0; }
.lesson-content .lesson-code__stdout { background: #0d1117; border-top: 1px solid #2e2e33; }
.lesson-content.dark .lesson-code__stdout { background: #0a0c14; border-top-color: #2e2e33; }
.lesson-content .lesson-code__stdout-pre { margin: 0; padding: 10px 14px; font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 12.5px; color: #c9d1d9; white-space: pre-wrap; word-break: break-all; }
.lesson-content .lesson-code__stdout-pre--return { color: #79c0ff; }
.lesson-content .lesson-code__plots { display: grid; gap: 12px; padding: 12px 14px 14px; }
.lesson-content .lesson-code__plot { background: #fff; border-radius: 8px; padding: 10px; overflow: hidden; }
.lesson-content .lesson-code__plot img { display: block; max-width: 100%; height: auto; margin: 0 auto; }

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

.lesson-style-menu { display: inline-flex; }
.lesson-style-menu__trigger { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 7px; border: none; background: rgba(0,0,0,0.05); color: #52525b; cursor: pointer; }
.lesson-style-menu__trigger[data-theme="dark"] { background: rgba(255,255,255,0.08); color: #a1a1aa; }
.lesson-style-menu__trigger:hover, .lesson-style-menu__trigger[data-open="true"] { background: rgba(0,0,0,0.1); color: #18181b; }
.lesson-style-menu__trigger[data-theme="dark"]:hover, .lesson-style-menu__trigger[data-theme="dark"][data-open="true"] { background: rgba(255,255,255,0.16); color: #fafafa; }
.lesson-content .lesson-block-corner { position: absolute; top: 8px; right: 8px; z-index: 5; }
.lesson-block-corner .lesson-style-menu__trigger { background: rgba(255,255,255,0.92); color: #3f3f46; box-shadow: 0 1px 4px rgba(0,0,0,0.25); }
.lesson-block-corner .lesson-style-menu__trigger[data-theme="dark"] { background: rgba(30,30,34,0.92); color: #e4e4e7; }
.lesson-style-menu__panel { z-index: 1000; min-width: 220px; max-width: 280px; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: #ffffff; border: 1px solid #e4e4e7; box-shadow: 0 10px 30px rgba(0,0,0,0.16); font-size: 13px; }
.lesson-style-menu__panel.dark { background: #1c1c20; border-color: #2e2e33; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.lesson-style-menu__row { display: flex; flex-direction: column; gap: 5px; }
.lesson-style-menu__row-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
.lesson-style-menu__panel.dark .lesson-style-menu__row-label { color: #a1a1aa; }
.lesson-style-menu__row-control { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }

.lesson-content .lesson-image { margin: 0.9rem 0; position: relative; }
.lesson-content .lesson-image > img { display: block; height: auto; margin: 0; box-sizing: border-box; }
.lesson-content .lesson-image__caption { font-size: 12.5px; color: #71717a; margin-top: 6px; }
.lesson-content.dark .lesson-image__caption { color: #a1a1aa; }
.lesson-content .lesson-image__caption-input { width: 100%; max-width: 520px; margin-top: 6px; font: inherit; font-size: 12.5px; text-align: center; color: #71717a; background: transparent; border: none; border-bottom: 1px dashed #d4d4d8; outline: none; padding: 2px 0; }
.lesson-content.dark .lesson-image__caption-input { color: #a1a1aa; border-bottom-color: #3f3f46; }
.lesson-content .lesson-image__caption-input::placeholder { color: #c4c4c8; }
.lesson-content .lesson-image__alt-input { font: inherit; font-size: 11px; width: 110px; padding: 3px 7px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.02); color: #52525b; outline: none; }
.lesson-content.dark .lesson-image__alt-input { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #d4d4d8; }

.lesson-content .lesson-audio { margin: 0.9rem 0; position: relative; width: 100%; }
.lesson-content .lesson-audio__player { width: 100%; max-width: 520px; border-radius: 10px; color-scheme: light; }
.lesson-content.dark .lesson-audio__player { color-scheme: dark; }
.lesson-content .lesson-audio__caption { font-size: 12.5px; color: #71717a; margin-top: 6px; }
.lesson-content.dark .lesson-audio__caption { color: #a1a1aa; }
.lesson-content .lesson-audio__caption-input { width: 100%; max-width: 520px; margin-top: 6px; font: inherit; font-size: 12.5px; text-align: center; color: #71717a; background: transparent; border: none; border-bottom: 1px dashed #d4d4d8; outline: none; padding: 2px 0; }
.lesson-content.dark .lesson-audio__caption-input { color: #a1a1aa; border-bottom-color: #3f3f46; }
.lesson-content .lesson-audio__caption-input::placeholder { color: #c4c4c8; }

.lesson-content .lesson-carousel { margin: 0.9rem 0; position: relative; container-type: inline-size; --card-border-default: #e4e4e7; }
.lesson-content.dark .lesson-carousel { --card-border-default: #3f3f46; }
.lesson-content .lesson-carousel__viewport { display: flex; align-items: center; gap: 8px; }
.lesson-content .lesson-carousel__slides { flex: 1; min-width: 0; }
.lesson-content .lesson-carousel__slide { display: none; background: #ffffff; border-radius: var(--card-radius, 14px); border-style: var(--card-border-style, none); border-width: var(--card-border-width, 0); border-color: var(--card-border-color, var(--card-border-default, #e4e4e7)); box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.07); overflow: hidden; }
.lesson-content.dark .lesson-carousel__slide { background: #1a1a1e; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
.lesson-content .lesson-carousel__cover-wrap { position: relative; margin-bottom: 14px; }
.lesson-content .lesson-carousel__cover { display: block; width: 100%; height: auto; border-radius: var(--cover-radius, 10px); }
.lesson-content .lesson-carousel__cover-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; }
.lesson-content .lesson-carousel__cover-btn { font-size: 11px; font-weight: 600; color: #fff; background: rgba(0,0,0,0.55); border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.lesson-content .lesson-carousel__cover-btn:hover { background: rgba(0,0,0,0.7); }
.lesson-content .lesson-carousel__cover-add { display: flex; align-items: center; justify-content: center; gap: 6px; height: 110px; margin-bottom: 14px; font-size: 13px; font-weight: 600; color: #71717a; border: 1px dashed #d4d4d8; border-radius: 10px; cursor: pointer; }
.lesson-content.dark .lesson-carousel__cover-add { color: #a1a1aa; border-color: #3f3f46; }
.lesson-content .lesson-carousel__spin { animation: lesson-code-spin 0.8s linear infinite; }
.lesson-content .lesson-carousel__body { padding: 18px 22px 20px; }
.lesson-content .lesson-carousel__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-carousel__title { font-size: 1.2rem; font-weight: 700; color: #18181b; margin: 0 0 8px; letter-spacing: -0.01em; }
.lesson-content.dark .lesson-carousel__title { color: #fafafa; }
.lesson-content .lesson-carousel__title-input { width: 100%; font: inherit; font-size: 1.2rem; font-weight: 700; color: #18181b; background: transparent; border: none; outline: none; padding: 0; margin-bottom: 8px; letter-spacing: -0.01em; }
.lesson-content.dark .lesson-carousel__title-input { color: #fafafa; }
.lesson-content .lesson-carousel__title-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-carousel[data-active="0"] .lesson-carousel__slide[data-slide-index="0"],
.lesson-content .lesson-carousel[data-active="1"] .lesson-carousel__slide[data-slide-index="1"],
.lesson-content .lesson-carousel[data-active="2"] .lesson-carousel__slide[data-slide-index="2"],
.lesson-content .lesson-carousel[data-active="3"] .lesson-carousel__slide[data-slide-index="3"],
.lesson-content .lesson-carousel[data-active="4"] .lesson-carousel__slide[data-slide-index="4"],
.lesson-content .lesson-carousel[data-active="5"] .lesson-carousel__slide[data-slide-index="5"],
.lesson-content .lesson-carousel[data-active="6"] .lesson-carousel__slide[data-slide-index="6"],
.lesson-content .lesson-carousel[data-active="7"] .lesson-carousel__slide[data-slide-index="7"],
.lesson-content .lesson-carousel[data-active="8"] .lesson-carousel__slide[data-slide-index="8"],
.lesson-content .lesson-carousel[data-active="9"] .lesson-carousel__slide[data-slide-index="9"],
.lesson-content .lesson-carousel[data-active="10"] .lesson-carousel__slide[data-slide-index="10"],
.lesson-content .lesson-carousel[data-active="11"] .lesson-carousel__slide[data-slide-index="11"],
.lesson-content .lesson-carousel[data-active="12"] .lesson-carousel__slide[data-slide-index="12"],
.lesson-content .lesson-carousel[data-active="13"] .lesson-carousel__slide[data-slide-index="13"],
.lesson-content .lesson-carousel[data-active="14"] .lesson-carousel__slide[data-slide-index="14"],
.lesson-content .lesson-carousel[data-active="15"] .lesson-carousel__slide[data-slide-index="15"],
.lesson-content .lesson-carousel[data-active="16"] .lesson-carousel__slide[data-slide-index="16"],
.lesson-content .lesson-carousel[data-active="17"] .lesson-carousel__slide[data-slide-index="17"],
.lesson-content .lesson-carousel[data-active="18"] .lesson-carousel__slide[data-slide-index="18"],
.lesson-content .lesson-carousel[data-active="19"] .lesson-carousel__slide[data-slide-index="19"] { display: block; animation: lesson-carousel-slide 0.28s ease; }
@keyframes lesson-carousel-slide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .lesson-content .lesson-carousel__slide { animation: none !important; } }
.lesson-content .lesson-carousel__arrow { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 999px; border: none; background: #111827; color: #fff; cursor: pointer; transition: opacity 0.15s; }
.lesson-content.dark .lesson-carousel__arrow { background: #e4e4e7; color: #18181b; }
.lesson-content .lesson-carousel__arrow:disabled { opacity: 0.25; cursor: default; }
/* Narrow column (mobile): side arrows would squeeze the slide into a long thin column, so reflow them onto a top row (right-aligned) and let the slide span full width below. Keyed to the carousel's own width, not the viewport. */
@container (max-width: 560px) {
  .lesson-content .lesson-carousel__viewport { flex-wrap: wrap; justify-content: flex-end; column-gap: 6px; row-gap: 12px; }
  .lesson-content .lesson-carousel__slides { order: 2; flex-basis: 100%; }
  .lesson-content .lesson-carousel__arrow { width: 34px; height: 34px; }
}
.lesson-content .lesson-carousel__nav { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.lesson-content .lesson-carousel__dot-wrap { display: inline-flex; align-items: center; }
.lesson-content .lesson-carousel__dot { min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; border: 1.5px solid transparent; background: transparent; color: #71717a; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.lesson-content.dark .lesson-carousel__dot { color: #a1a1aa; }
.lesson-content .lesson-carousel__dot[data-active="true"] { border-color: #18181b; color: #18181b; }
.lesson-content.dark .lesson-carousel__dot[data-active="true"] { border-color: #fafafa; color: #fafafa; }
.lesson-content .lesson-carousel__check { display: inline-flex; align-items: center; margin-left: 2px; color: #d4d4d8; }
.lesson-content .lesson-carousel__check[data-on="true"] { color: var(--lesson-accent); }
.lesson-content .lesson-carousel__remove { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: -2px; border: none; background: transparent; color: #c4c4c8; cursor: pointer; border-radius: 999px; }
.lesson-content .lesson-carousel__remove:hover { color: #ef4444; }
.lesson-content .lesson-carousel__add { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px dashed #cbd5e1; background: transparent; color: #71717a; cursor: pointer; border-radius: 999px; margin-left: 4px; }
.lesson-content.dark .lesson-carousel__add { border-color: #3f3f46; color: #a1a1aa; }

/* Flip cards (flashcards) */
.lesson-content .lesson-flip-deck { margin: 0.9rem 0; }
/* TipTap renders child node views inside an inner [data-node-view-content-react]
   wrapper, so the grid must sit on that wrapper -- not the NodeViewContent element --
   or the cards stack vertically (the wrapper would be the lone grid item). */
.lesson-content .lesson-flip-deck__grid > [data-node-view-content-react] { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; align-items: start; }
.lesson-content .lesson-flip { min-width: 0; }
.lesson-content .lesson-flip__card { display: block; width: 100%; padding: 0; border: none; background: transparent; cursor: pointer; perspective: 1000px; font: inherit; }
/* Both faces share one grid cell so the card grows to the taller side's content
   (instead of clipping against a fixed height) while still flipping in 3D. */
.lesson-content .lesson-flip__inner { position: relative; display: grid; width: 100%; min-height: 120px; transition: transform 0.5s cubic-bezier(0.4,0.2,0.2,1); transform-style: preserve-3d; }
.lesson-content .lesson-flip[data-flipped="true"] .lesson-flip__inner { transform: rotateY(180deg); }
.lesson-content .lesson-flip__face { grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px; border-radius: 12px; text-align: center; backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 22px rgba(0,0,0,0.07); }
.lesson-content .lesson-flip__face--front { background: #ffffff; color: #18181b; font-weight: 600; }
.lesson-content .lesson-flip__face--back { background: #ecfdf5; color: #065f46; transform: rotateY(180deg); }
.lesson-content.dark .lesson-flip__face--front { background: #1a1a1e; color: #fafafa; }
.lesson-content.dark .lesson-flip__face--back { background: rgba(16,185,129,0.16); color: #6ee7b7; }
.lesson-content .lesson-flip__text { font-size: 15px; line-height: 1.45; }
.lesson-content .lesson-flip__hint { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #a1a1aa; }
@media (prefers-reduced-motion: reduce) { .lesson-content .lesson-flip__inner { transition: none; } }
.lesson-content .lesson-flip__edit { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 12px 12px 14px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; min-height: 132px; box-sizing: border-box; }
.lesson-content.dark .lesson-flip__edit { border-color: #3f3f46; background: #1a1a1e; }
.lesson-content .lesson-flip__edit-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; }
.lesson-content .lesson-flip__edit-input { width: 100%; font: inherit; font-size: 13.5px; color: #18181b; background: transparent; border: none; outline: none; resize: vertical; min-height: 28px; box-sizing: border-box; }
.lesson-content.dark .lesson-flip__edit-input { color: #fafafa; }
.lesson-content .lesson-flip__edit-input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-flip__edit-divider { border-top: 1px dashed #e4e4e7; margin: 4px 0; }
.lesson-content.dark .lesson-flip__edit-divider { border-top-color: #3f3f46; }
.lesson-content .lesson-flip__remove { position: absolute; top: 6px; right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: #c4c4c8; cursor: pointer; border-radius: 6px; }
.lesson-content .lesson-flip__remove:hover { color: #ef4444; background: rgba(0,0,0,0.04); }
.lesson-content .lesson-flip-deck__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #52525b; background: transparent; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer; }
.lesson-content .lesson-flip-deck__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-flip-deck__add { color: #a1a1aa; border-color: #3f3f46; }

/* Vertical stepper */
/* Step cards: scan-friendly numbered instruction cards with optional guidance. */
.lesson-content .lesson-step-cards { margin: 0.9rem 0; }
/* TipTap places the individual step-card node views in an inner content wrapper. */
.lesson-content .lesson-step-cards__items > [data-node-view-content-react] { display: flex; flex-direction: column; gap: 16px; }
.lesson-content .lesson-step-card { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px; padding: 18px 20px 18px 16px; border: 0; border-radius: 16px; background: #ffffff; box-shadow: 0 7px 22px rgba(15,23,42,0.05); }
.lesson-content.dark .lesson-step-card { border: 0; background: rgba(255,255,255,0.035); box-shadow: none; }
.lesson-content .lesson-step-card__number { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px; color: #fff; background: var(--lesson-accent); box-shadow: 0 5px 14px var(--lesson-accent-ring); font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; user-select: none; }
.lesson-content .lesson-step-card__main { min-width: 0; }
.lesson-content .lesson-step-card__header { display: flex; align-items: center; gap: 8px; min-height: 36px; margin-bottom: 3px; }
.lesson-content .lesson-step-card__title { flex: 1; margin: 0; color: #18181b; font-size: 1.18rem; font-weight: 750; letter-spacing: -0.01em; line-height: 1.35; }
.lesson-content.dark .lesson-step-card__title { color: #fafafa; }
.lesson-content .lesson-step-card__title-input { flex: 1; min-width: 0; padding: 2px 0; border: 0; border-bottom: 1px dashed #d4d4d8; outline: 0; color: #18181b; background: transparent; font: inherit; font-size: 1.18rem; font-weight: 750; line-height: 1.35; }
.lesson-content.dark .lesson-step-card__title-input { border-bottom-color: #3f3f46; color: #fafafa; }
.lesson-content .lesson-step-card__title-input::placeholder { color: #a1a1aa; font-weight: 650; }
.lesson-content .lesson-step-card__controls { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; transition: opacity 0.15s ease; }
.lesson-content .lesson-step-card__action { display: inline-flex; align-items: center; justify-content: center; width: 25px; height: 25px; padding: 0; border: 0; border-radius: 7px; color: #a1a1aa; background: transparent; cursor: pointer; }
.lesson-content .lesson-step-card__action:hover { color: var(--lesson-accent-ink); background: var(--lesson-accent-ring); }
.lesson-content .lesson-step-card__action:disabled { opacity: 0.28; color: #a1a1aa; background: transparent; cursor: not-allowed; }
.lesson-content .lesson-step-card__remove:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
@media (hover: hover) {
  .lesson-content .lesson-step-card__controls { opacity: 0; }
  .lesson-content .lesson-step-card:hover .lesson-step-card__controls, .lesson-content .lesson-step-card:focus-within .lesson-step-card__controls { opacity: 1; }
}
.lesson-content .lesson-step-card__body { color: #52525b; }
.lesson-content.dark .lesson-step-card__body { color: #b4b4bc; }
.lesson-content .lesson-step-card__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-step-card__highlight { margin-top: 15px; padding: 12px 14px 12px 15px; border-left: 3px solid var(--lesson-accent); border-radius: 0 11px 11px 0; background: color-mix(in oklab, var(--lesson-accent-base) 8%, #f8fafc); }
.lesson-content .lesson-step-card__highlight[data-editing="true"] { position: relative; padding-right: 38px; }
.lesson-content.dark .lesson-step-card__highlight { background: color-mix(in oklab, var(--lesson-accent-base) 10%, rgba(255,255,255,0.035)); }
.lesson-content .lesson-step-card__highlight[data-empty="true"] { border-left-color: #cbd5e1; }
.lesson-content.dark .lesson-step-card__highlight[data-empty="true"] { border-left-color: #52525b; }
.lesson-content .lesson-step-card__highlight-title { margin: 0 0 5px; color: var(--lesson-accent-ink); font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; line-height: 1.4; text-transform: uppercase; }
.lesson-content .lesson-step-card__highlight-body { margin: 0; color: #3f3f46; font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; }
.lesson-content.dark .lesson-step-card__highlight-body { color: #d4d4d8; }
.lesson-content .lesson-step-card__highlight-title-input { display: block; width: 100%; padding: 0 0 5px; border: 0; outline: 0; color: var(--lesson-accent-ink); background: transparent; font: inherit; font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; line-height: 1.4; text-transform: uppercase; }
.lesson-content .lesson-step-card__highlight-title-input::placeholder { color: #8b8b93; }
.lesson-content .lesson-step-card__highlight-body-input { display: block; width: 100%; min-height: 50px; padding: 0; border: 0; outline: 0; resize: vertical; color: #3f3f46; background: transparent; font: inherit; font-size: 13.5px; line-height: 1.55; }
.lesson-content.dark .lesson-step-card__highlight-body-input { color: #d4d4d8; }
.lesson-content .lesson-step-card__highlight-body-input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-step-card__add-guidance { display: inline-flex; align-items: center; gap: 5px; margin-top: 9px; padding: 4px 7px; border: 0; border-radius: 7px; color: var(--lesson-accent-ink); background: transparent; cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }
.lesson-content .lesson-step-card__add-guidance:hover { background: var(--lesson-accent-ring); }
.lesson-content .lesson-step-card__remove-guidance { position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 6px; color: #a1a1aa; background: transparent; cursor: pointer; }
.lesson-content .lesson-step-card__remove-guidance:hover { color: #ef4444; background: rgba(239,68,68,0.08); }
.lesson-content .lesson-step-cards__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 6px 11px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #52525b; background: transparent; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
.lesson-content .lesson-step-cards__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-step-cards__add { border-color: #3f3f46; color: #a1a1aa; }
@media (max-width: 560px) {
  .lesson-content .lesson-step-cards__items > [data-node-view-content-react] { gap: 12px; }
  .lesson-content .lesson-step-card { grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 15px 14px 15px 12px; border-radius: 14px; }
  .lesson-content .lesson-step-card__number { width: 32px; height: 32px; font-size: 13px; }
  .lesson-content .lesson-step-card__header { min-height: 32px; }
  .lesson-content .lesson-step-card__title, .lesson-content .lesson-step-card__title-input { font-size: 1.06rem; }
}

.lesson-content .lesson-stepper { margin: 0.9rem 0; }
.lesson-content .lesson-step { display: none; gap: 14px; margin-top: 22px; position: relative; }
.lesson-content .lesson-step[data-step-index="0"] { margin-top: 0; }
/* Static dashed connector from each marker to the next. It spans this step's full
   height plus the gap, so it reaches the next marker regardless of body length; the
   generated rules above hide it on the last revealed step. */
.lesson-content .lesson-step::after { content: ''; position: absolute; left: 15px; top: 32px; bottom: -22px; width: 2px; transform: translateX(-50%); z-index: 0; background-image: repeating-linear-gradient(to bottom, var(--lesson-accent) 0 5px, transparent 5px 11px); background-size: 2px 11px; background-repeat: repeat-y; }
/* New steps animate in as they are revealed (keyed to the newest step in the rules above). */
@keyframes lesson-step-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .lesson-content .lesson-step { animation: none !important; } }
${stepReveal}
.lesson-content .lesson-step__marker { flex-shrink: 0; position: relative; z-index: 1; }
.lesson-content .lesson-step__num { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 999px; background: var(--lesson-accent); color: #fff; font-size: 13px; font-weight: 700; }
.lesson-content .lesson-step__main { flex: 1; min-width: 0; }
.lesson-content .lesson-step__head { display: flex; align-items: center; gap: 8px; min-height: 30px; margin-bottom: 2px; }
.lesson-content .lesson-step__title { font-size: 1.05rem; font-weight: 700; color: #18181b; margin: 0; }
.lesson-content.dark .lesson-step__title { color: #fafafa; }
.lesson-content .lesson-step__title-input { flex: 1; min-width: 0; font: inherit; font-size: 1.05rem; font-weight: 700; color: #18181b; background: transparent; border: none; outline: none; padding: 0; }
.lesson-content.dark .lesson-step__title-input { color: #fafafa; }
.lesson-content .lesson-step__title-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-step__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-step__remove { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: #c4c4c8; cursor: pointer; border-radius: 6px; flex-shrink: 0; }
.lesson-content .lesson-step__remove:hover { color: #ef4444; }
.lesson-content .lesson-stepper__next { display: inline-flex; align-items: center; gap: 6px; margin: 16px 0 0 44px; padding: 8px 16px; border-radius: 999px; border: none; background: var(--lesson-accent); color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.lesson-content .lesson-stepper__next:hover { background: var(--lesson-accent-strong); }
.lesson-content .lesson-stepper__done { display: inline-flex; align-items: center; gap: 6px; margin: 16px 0 0 44px; color: var(--lesson-accent-ink); font-size: 13px; font-weight: 600; }
.lesson-content .lesson-stepper__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 16px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #52525b; background: transparent; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer; }
.lesson-content .lesson-stepper__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-stepper__add { color: #a1a1aa; border-color: #3f3f46; }

/* AI Prompt Lab */
.lesson-content .lesson-prompt { position: relative; overflow: hidden; margin: 1.1rem 0; border: 0; border-radius: 18px; background: #ffffff; box-shadow: 0 14px 38px rgba(15,23,42,0.08), 0 2px 7px rgba(15,23,42,0.04); }
.lesson-content.dark .lesson-prompt { border: 1px solid rgba(255,255,255,0.065); background: #18181b; box-shadow: 0 20px 48px rgba(0,0,0,0.3); }
.lesson-content .lesson-prompt__header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 14px; }
.lesson-content .lesson-prompt__heading { min-width: 0; flex: 1; }
.lesson-content .lesson-prompt__eyebrow { display: block; margin-bottom: 1px; color: var(--lesson-accent-ink); font-size: 9.5px; font-weight: 800; letter-spacing: 0.15em; line-height: 1.4; text-transform: uppercase; }
.lesson-content .lesson-prompt__title { margin: 0; color: #18181b; font-size: 15px; font-weight: 730; line-height: 1.35; }
.lesson-content.dark .lesson-prompt__title { color: #fafafa; }
.lesson-content .lesson-prompt__title-input { display: block; width: 100%; padding: 0; border: 0; outline: 0; color: #18181b; background: transparent; font: inherit; font-size: 15px; font-weight: 730; line-height: 1.35; }
.lesson-content.dark .lesson-prompt__title-input { color: #fafafa; }
.lesson-content .lesson-prompt__title-input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-prompt__status { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 5px 9px; border-radius: 999px; color: var(--lesson-accent-ink); background: color-mix(in oklab, var(--lesson-accent) 7%, transparent); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; }
.lesson-content .lesson-prompt__status > span { width: 6px; height: 6px; border-radius: 999px; background: var(--lesson-accent); box-shadow: 0 0 0 3px var(--lesson-accent-ring); animation: lesson-prompt-pulse 2.4s ease-in-out infinite; }
.lesson-content .lesson-prompt__surface { overflow: hidden; margin: 0 16px; border: 0; border-radius: 13px; background: #f5f7f8; }
.lesson-content.dark .lesson-prompt__surface { border: 0; background: rgba(255,255,255,0.045); box-shadow: none; }
.lesson-content .lesson-prompt__surface-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 11px; border-bottom: 1px solid rgba(15,23,42,0.045); color: #71717a; background: rgba(244,244,245,0.72); font-size: 9px; font-weight: 750; letter-spacing: 0.1em; text-transform: uppercase; }
.lesson-content.dark .lesson-prompt__surface-bar { border-bottom-color: rgba(255,255,255,0.045); color: #8b8b93; background: rgba(255,255,255,0.025); }
.lesson-content .lesson-prompt__surface-bar span:last-child { letter-spacing: 0.02em; text-transform: none; font-variant-numeric: tabular-nums; }
.lesson-content .lesson-prompt__text { min-height: 92px; max-height: 330px; overflow: auto; margin: 0; padding: 15px 16px; border: 0; border-radius: 0; color: #27272a; background: transparent; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13.5px; line-height: 1.62; }
.lesson-content.dark .lesson-prompt__text { border: 0; color: #e4e4e7; background: transparent; }
.lesson-content .lesson-prompt__text code, .lesson-content.dark .lesson-prompt__text code { padding: 0; border-radius: 0; color: inherit; background: transparent; font: inherit; }
.lesson-content .lesson-prompt__input { display: block; width: 100%; min-height: 116px; max-height: 330px; resize: vertical; margin: 0; padding: 15px 16px; border: 0; outline: 0; color: #27272a; background: transparent; font-family: "JetBrains Mono","Fira Code",ui-monospace,monospace; font-size: 13.5px; line-height: 1.62; }
.lesson-content.dark .lesson-prompt__input { color: #e4e4e7; }
.lesson-content .lesson-prompt__input::placeholder { color: #a1a1aa; }
.lesson-content .lesson-prompt__input:focus { box-shadow: inset 0 0 0 2px var(--lesson-accent-ring); }
.lesson-content .lesson-prompt__provider-settings { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 10px 16px 0; padding: 9px 10px; border-radius: 11px; background: #f5f7f8; }
.lesson-content.dark .lesson-prompt__provider-settings { background: rgba(255,255,255,0.045); }
.lesson-content .lesson-prompt__provider-settings-label { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.lesson-content .lesson-prompt__provider-settings-label > span { color: #3f3f46; font-size: 10.5px; font-weight: 750; }
.lesson-content.dark .lesson-prompt__provider-settings-label > span { color: #d4d4d8; }
.lesson-content .lesson-prompt__provider-settings-label > small { color: #8b8b93; font-size: 9.5px; }
.lesson-content .lesson-prompt__provider-toggles { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.lesson-content .lesson-prompt__provider-toggles button { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 5px 7px 5px 8px; border: 0; border-radius: 8px; color: #71717a; background: rgba(255,255,255,0.8); cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }
.lesson-content.dark .lesson-prompt__provider-toggles button { color: #a1a1aa; background: rgba(255,255,255,0.055); box-shadow: none; }
.lesson-content .lesson-prompt__provider-toggles button[data-active="true"] { color: #18181b; background: #ffffff; }
.lesson-content.dark .lesson-prompt__provider-toggles button[data-active="true"] { color: #f4f4f5; background: rgba(255,255,255,0.1); }
.lesson-content .lesson-prompt__provider-toggles button:focus-visible { outline: 2px solid var(--lesson-accent) !important; outline-offset: 1px; }
.lesson-content .lesson-prompt__provider-toggles img { display: block; width: 13px; height: 13px; flex: 0 0 13px; margin: 0; border-radius: 3px; object-fit: contain; }
.lesson-content .lesson-prompt__provider-toggles i { position: relative; display: block; width: 22px; height: 13px; margin-left: 1px; border-radius: 999px; background: #d4d4d8; transition: background 0.16s ease; }
.lesson-content .lesson-prompt__provider-toggles i::after { content: ''; position: absolute; width: 9px; height: 9px; left: 2px; top: 2px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.16); transition: transform 0.16s ease; }
.lesson-content .lesson-prompt__provider-toggles button[data-active="true"] i { background: var(--lesson-accent); }
.lesson-content .lesson-prompt__provider-toggles button[data-active="true"] i::after { transform: translateX(9px); }
.lesson-content .lesson-prompt__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; }
.lesson-content .lesson-prompt__guidance { display: flex; align-items: center; gap: 7px; min-width: 0; color: #71717a; font-size: 10.5px; line-height: 1.35; }
.lesson-content.dark .lesson-prompt__guidance { color: #8b8b93; }
.lesson-content .lesson-prompt__guidance svg { flex: 0 0 auto; color: var(--lesson-accent-ink); }
.lesson-content .lesson-prompt__actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex: 0 0 auto; }
.lesson-content .lesson-prompt__button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 7px 10px; border: 1px solid transparent; border-radius: 9px; text-decoration: none; white-space: nowrap; cursor: pointer; transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, border-color 0.16s ease; font: inherit; font-size: 10.5px; font-weight: 720; line-height: 1; }
.lesson-content .lesson-prompt__button:hover:not(.is-disabled):not(:disabled) { opacity: 1; transform: translateY(-1px); }
.lesson-content .lesson-prompt__button:focus-visible { outline: 2px solid var(--lesson-accent) !important; outline-offset: 2px; }
.lesson-content .lesson-prompt__brand-icon { display: block; width: 16px; height: 16px; flex: 0 0 16px; object-fit: contain; margin: 0; border-radius: 3px; }
.lesson-content .lesson-prompt__brand-icon--wide { width: 58px; flex-basis: 58px; border-radius: 0; }
.lesson-content .lesson-prompt__button--copy { border-color: #d4d4d8; color: #3f3f46; background: rgba(255,255,255,0.9); }
.lesson-content .lesson-prompt__button--copy:hover:not(:disabled) { border-color: #a1a1aa; box-shadow: 0 5px 14px rgba(15,23,42,0.08); }
.lesson-content.dark .lesson-prompt__button--copy { border-color: rgba(255,255,255,0.12); color: #d4d4d8; background: rgba(255,255,255,0.055); }
.lesson-content .lesson-prompt__button--chatgpt { color: #fff; background: #18181b; box-shadow: 0 5px 14px rgba(24,24,27,0.16); }
.lesson-content.dark .lesson-prompt__button--chatgpt { color: #18181b; background: #f4f4f5; box-shadow: none; }
.lesson-content .lesson-prompt__button--claude { border-color: #fcd34d; color: #78350f; background: #fef3c7; }
.lesson-content.dark .lesson-prompt__button--claude { border-color: transparent; color: #5f321f; background: #f2e8dc; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.lesson-content .lesson-prompt__button.is-disabled, .lesson-content .lesson-prompt__button:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; transform: none; }
@keyframes lesson-prompt-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.82); } }
@media (max-width: 640px) {
  .lesson-content .lesson-prompt__status { display: none; }
  .lesson-content .lesson-prompt__provider-settings { align-items: stretch; flex-direction: column; }
  .lesson-content .lesson-prompt__provider-toggles { justify-content: space-between; }
  .lesson-content .lesson-prompt__footer { align-items: stretch; flex-direction: column; }
  .lesson-content .lesson-prompt__actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); width: 100%; }
  .lesson-content .lesson-prompt__button { padding-inline: 7px; }
  .lesson-content .lesson-prompt__button svg:last-child { display: none; }
}
@media (max-width: 390px) {
  .lesson-content .lesson-prompt__actions { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .lesson-content .lesson-prompt__status > span { animation: none; }
  .lesson-content .lesson-prompt__button { transition: none; }
}

/* Glossary term (inline definition tooltip) */
.lesson-content .lesson-term { border-bottom: 1px dotted var(--lesson-accent); cursor: help; }
/* The definition popover is rendered by GlossaryTooltip into a body portal (fixed +
   global, so the lesson card's overflow can never clip it). These rules are global,
   not scoped under .lesson-content, because the portal lives outside it. */
.lesson-term-tip { max-width: 300px; padding: 11px 14px; border-radius: 12px; background: #ffffff; border: 1px solid rgba(0,0,0,0.08); color: #27272a; font-size: 13px; line-height: 1.5; font-weight: 450; box-shadow: 0 12px 32px rgba(0,0,0,0.16), 0 3px 8px rgba(0,0,0,0.08); transform-origin: bottom center; animation: lesson-term-tip-in 0.15s ease; }
.lesson-term-tip[data-placement="bottom"] { transform-origin: top center; }
.lesson-term-tip[data-theme="dark"] { background: #1c1c20; border-color: rgba(255,255,255,0.1); color: #e4e4e7; box-shadow: 0 12px 32px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.4); }
@keyframes lesson-term-tip-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .lesson-term-tip { animation: none; } }

/* Timeline */
.lesson-content .lesson-timeline { margin: 0.9rem 0; }
/* Layout per entry: [date column] [dot + connector] [title + body]. */
.lesson-content .lesson-timeline__entry { position: relative; display: flex; gap: 12px; padding-bottom: 24px; }
/* Connector line is on the entry (always full height) at the dot column's center
   (date col 120 + gap 12 + dot half 7 = 139px), running from below the dot to the
   entry's bottom edge -- i.e. up to the next dot. */
.lesson-content .lesson-timeline__entry::after { content: ''; position: absolute; left: 139px; top: 22px; bottom: 0; width: 2px; transform: translateX(-50%); background: #e4e4e7; }
.lesson-content.dark .lesson-timeline__entry::after { background: #3f3f46; }
/* Last entry: no connector and no trailing space. Keyed off TipTap's per-node wrapper
   (.node-timelineEntry) so it always tracks the real DOM order -- a React-derived flag
   would go stale because adding a sibling need not re-render the previous entry. */
.lesson-content [data-node-view-content-react] > .node-timelineEntry:last-child .lesson-timeline__entry { padding-bottom: 0; }
.lesson-content [data-node-view-content-react] > .node-timelineEntry:last-child .lesson-timeline__entry::after { display: none; }
/* Wide enough for a short phrase (not just a year), right-aligned so short labels
   still hug the line; longer ones wrap within the column without shifting the dots. */
.lesson-content .lesson-timeline__date-col { flex-shrink: 0; width: 120px; padding-top: 2px; text-align: right; overflow-wrap: break-word; }
.lesson-content .lesson-timeline__dot { position: relative; flex-shrink: 0; width: 14px; }
.lesson-content .lesson-timeline__dot::before { content: ''; position: absolute; left: 50%; top: 6px; transform: translateX(-50%); width: 12px; height: 12px; border-radius: 999px; background: var(--lesson-accent); box-shadow: 0 0 0 3px var(--lesson-accent-ring); z-index: 1; }
.lesson-content .lesson-timeline__content { flex: 1; min-width: 0; }
.lesson-content .lesson-timeline__meta { display: flex; align-items: baseline; gap: 8px; min-height: 22px; margin-bottom: 4px; }
.lesson-content .lesson-timeline__date { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.5; color: var(--lesson-accent-ink); }
.lesson-content .lesson-timeline__title { font-size: 1.05rem; font-weight: 700; color: #18181b; }
.lesson-content.dark .lesson-timeline__title { color: #fafafa; }
.lesson-content .lesson-timeline__body > :last-child { margin-bottom: 0; }
.lesson-content .lesson-timeline__date-input { width: 100%; text-align: right; font: inherit; font-size: 12px; font-weight: 700; color: var(--lesson-accent-ink); background: transparent; border: none; border-bottom: 1px dashed #d4d4d8; outline: none; padding: 1px 0; }
.lesson-content.dark .lesson-timeline__date-input { border-bottom-color: #3f3f46; }
.lesson-content .lesson-timeline__date-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-timeline__title-input { flex: 1; min-width: 0; font: inherit; font-size: 1.05rem; font-weight: 700; color: #18181b; background: transparent; border: none; outline: none; padding: 0; }
.lesson-content.dark .lesson-timeline__title-input { color: #fafafa; }
.lesson-content .lesson-timeline__title-input::placeholder { color: #a1a1aa; font-weight: 600; }
.lesson-content .lesson-timeline__remove { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: #c4c4c8; cursor: pointer; border-radius: 6px; flex-shrink: 0; }
.lesson-content .lesson-timeline__remove:hover { color: #ef4444; }
.lesson-content .lesson-timeline__add { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #52525b; background: transparent; border: 1px dashed #cbd5e1; border-radius: 8px; cursor: pointer; }
.lesson-content .lesson-timeline__add:hover { background: rgba(0,0,0,0.03); }
.lesson-content.dark .lesson-timeline__add { color: #a1a1aa; border-color: #3f3f46; }
`}</style>
  );
}
