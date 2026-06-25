// Client-side contract + helpers for the inline "Ask AI" assistant.
// Shared by the TipTap adapter (components/lesson/LessonAiMenu) and the contentEditable
// adapter (components/RichTextAiMenu). Pure logic only -- no rendering.

import type { JSONContent } from '@tiptap/core';
import { supabase } from '@/lib/supabase';

export type AiAction =
  // text transforms (every surface)
  | 'improve' | 'expand' | 'summarize' | 'shorten'
  | 'grammar' | 'simplify' | 'formal' | 'continue' | 'custom'
  // interactive-block generators (lesson editor only)
  | 'make_auto' | 'make_callout' | 'make_quiz' | 'make_flashcards'
  | 'make_steps' | 'make_accordion' | 'make_tabs' | 'make_carousel' | 'make_timeline';

/** The interactive block kinds the assistant can produce (one per lesson node type). */
export type InteractiveKind =
  | 'callout' | 'quiz' | 'flashcards' | 'steps' | 'accordion' | 'tabs' | 'carousel' | 'timeline';

export interface AiActionDef {
  action: AiAction;
  label: string;
  group: 'text' | 'interactive';
}

// Quick text transforms, offered on every surface.
export const TEXT_ACTIONS: AiActionDef[] = [
  { action: 'improve',   label: 'Improve writing', group: 'text' },
  { action: 'expand',    label: 'Expand', group: 'text' },
  { action: 'summarize', label: 'Summarize', group: 'text' },
  { action: 'shorten',   label: 'Make shorter', group: 'text' },
  { action: 'grammar',   label: 'Fix spelling and grammar', group: 'text' },
  { action: 'simplify',  label: 'Simplify', group: 'text' },
  { action: 'formal',    label: 'More formal', group: 'text' },
  { action: 'continue',  label: 'Continue writing', group: 'text' },
];

// Offered only where interactive blocks have a runtime (the TipTap lesson editor).
// "Suggest best format" lets the model read the selection and pick the right one.
export const INTERACTIVE_ACTIONS: AiActionDef[] = [
  { action: 'make_auto',       label: 'Suggest best format', group: 'interactive' },
  { action: 'make_callout',    label: 'Callout', group: 'interactive' },
  { action: 'make_quiz',       label: 'Knowledge check', group: 'interactive' },
  { action: 'make_flashcards', label: 'Flashcards', group: 'interactive' },
  { action: 'make_steps',      label: 'Steps', group: 'interactive' },
  { action: 'make_accordion',  label: 'Accordion', group: 'interactive' },
  { action: 'make_tabs',       label: 'Tabs', group: 'interactive' },
  { action: 'make_carousel',   label: 'Carousel', group: 'interactive' },
  { action: 'make_timeline',   label: 'Timeline', group: 'interactive' },
];

const INTERACTIVE_ACTION_SET = new Set<string>(INTERACTIVE_ACTIONS.map((a) => a.action));

// Per-format generated payloads (mirror the lesson node attrs/content).
export interface CalloutData { variant: string; title: string; body: string }
export interface QuizData { question: string; options: string[]; correctIndex: number; explanation: string }
export interface FlashcardsData { cards: { front: string; back: string }[] }
export interface StepsData { steps: { title: string; body: string }[] }
export interface AccordionData { sections: { title: string; body: string }[] }
export interface TabsData { tabs: { label: string; body: string }[] }
export interface CarouselData { slides: { title: string; body: string }[] }
export interface TimelineData { entries: { date: string; title: string; body: string }[] }

export type AiResult =
  | { kind: 'text'; text: string }
  | { kind: 'callout'; data: CalloutData }
  | { kind: 'quiz'; data: QuizData }
  | { kind: 'flashcards'; data: FlashcardsData }
  | { kind: 'steps'; data: StepsData }
  | { kind: 'accordion'; data: AccordionData }
  | { kind: 'tabs'; data: TabsData }
  | { kind: 'carousel'; data: CarouselData }
  | { kind: 'timeline'; data: TimelineData };

export interface AskAiInput {
  action: AiAction;
  text: string;
  instruction?: string;
  contextText?: string;
}

/** Call the instructor-only /api/ai-assist route. Throws Error(message) on failure. */
export async function askAi(input: AskAiInput): Promise<AiResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/ai-assist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'AI request failed.');
  if (INTERACTIVE_ACTION_SET.has(input.action)) {
    // Route returns { kind: InteractiveKind, interactive: <payload> } (kind resolved server-side,
    // including the auto-suggest path that classifies the selection first).
    return { kind: data.kind, data: data.interactive } as AiResult;
  }
  return { kind: 'text', text: String(data?.result ?? '') };
}

/**
 * Plain text -> TipTap content nodes. Blank lines separate paragraphs; single
 * newlines become hard breaks. For insertContentAt in the lesson editor.
 */
export function textToParagraphNodes(text: string): JSONContent[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const content: JSONContent[] = [];
      lines.forEach((line, i) => {
        if (i > 0) content.push({ type: 'hardBreak' });
        if (line) content.push({ type: 'text', text: line });
      });
      return { type: 'paragraph', content: content.length ? content : undefined };
    });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text -> sanitized HTML paragraphs (block). For inserting a new block in RichTextEditor. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Plain text -> inline HTML (text + <br>, no block <p>). Use when replacing an INLINE
 * selection inside an existing block, so we never nest a <p> inside a paragraph / span /
 * list item and split the markup.
 */
export function textToInlineHtml(text: string): string {
  return escapeHtml(text.replace(/\r\n/g, '\n')).replace(/\n/g, '<br>');
}
