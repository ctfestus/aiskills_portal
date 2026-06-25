import { Type } from '@google/genai';

// Server-side logic for the inline "Ask AI" route, kept out of the route handler so it is
// unit-testable (the handler just does auth, rate limiting, and dispatch).
//
// Every prompt states its exact JSON shape. This matters because lib/ai.generateJSON only
// passes the response schema to Gemini -- the OpenAI fallback gets json_object mode with no
// schema, so the shape (and the literal word "JSON", which OpenAI's json mode requires) has
// to live in the prompt for the fallback to return the expected structure.

export const TEXT_ACTIONS = new Set([
  'improve', 'expand', 'summarize', 'shorten', 'grammar', 'simplify', 'formal', 'continue', 'custom',
]);

export const FORMATS = ['callout', 'quiz', 'flashcards', 'steps', 'accordion', 'tabs', 'carousel', 'timeline'] as const;
export type Format = typeof FORMATS[number];
export const FORMAT_SET = new Set<string>(FORMATS);
export const INTERACTIVE_ACTIONS = new Set<string>(['make_auto', ...FORMATS.map((f) => `make_${f}`)]);
export const ALLOWED_ACTIONS = new Set<string>([...TEXT_ACTIONS, ...INTERACTIVE_ACTIONS]);

export const CALLOUT_VARIANTS = new Set(['note', 'tip', 'warning', 'info', 'success']);

export const MAX_TEXT = 6000;
export const MAX_INSTRUCTION = 500;
export const MAX_CONTEXT = 1500;

// ---- Gemini response schemas ---

const ITEM = (props: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties: props, required });
const STR = { type: Type.STRING };
const STR_ARR = (props: Record<string, unknown>, required: string[]) => ({ type: Type.ARRAY, items: ITEM(props, required) });

export const TEXT_SCHEMA = ITEM({ result: STR }, ['result']);
export const FORMAT_PICK_SCHEMA = ITEM({ format: STR }, ['format']);

export const SCHEMAS: Record<Format, unknown> = {
  callout:   ITEM({ variant: STR, title: STR, body: STR }, ['variant', 'title', 'body']),
  quiz:      ITEM({ question: STR, options: { type: Type.ARRAY, items: STR }, correctIndex: { type: Type.INTEGER }, explanation: STR }, ['question', 'options', 'correctIndex', 'explanation']),
  flashcards: ITEM({ cards: STR_ARR({ front: STR, back: STR }, ['front', 'back']) }, ['cards']),
  steps:     ITEM({ steps: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['steps']),
  accordion: ITEM({ sections: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['sections']),
  tabs:      ITEM({ tabs: STR_ARR({ label: STR, body: STR }, ['label', 'body']) }, ['tabs']),
  carousel:  ITEM({ slides: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['slides']),
  timeline:  ITEM({ entries: STR_ARR({ date: STR, title: STR, body: STR }, ['date', 'title', 'body']) }, ['entries']),
};

// ---- Prompts ---

const TEXT_BASE =
  'You are editing one passage of an interactive lesson for an online learning platform. ' +
  'Preserve the meaning and the author\'s voice. Keep roughly the same paragraph structure ' +
  'unless the instruction says otherwise. Plain text only -- no markdown, no surrounding quotes.';

export function buildTextPrompt(action: string, text: string, instruction: string, context: string): string {
  const ctx = context
    ? `\n\nSurrounding lesson context (for tone only -- do not rewrite or repeat it):\n"""${context}"""`
    : '';
  const selected = `\n\nSelected text:\n"""${text}"""${ctx}`;
  const shape = '\n\nRespond as JSON: {"result": "<the rewritten passage>"}';
  let task: string;
  switch (action) {
    case 'improve':   task = 'Improve clarity, flow, and word choice without changing the meaning.'; break;
    case 'expand':    task = 'Expand with one or two more sentences of useful detail or a brief example. Stay concise.'; break;
    case 'summarize': task = 'Summarize into a shorter version that keeps the key points.'; break;
    case 'shorten':   task = 'Make it noticeably shorter and tighter while keeping the meaning.'; break;
    case 'grammar':   task = 'Fix spelling and grammar only. Do not change the wording or style beyond what is needed for correctness.'; break;
    case 'simplify':  task = 'Rewrite in simpler, plainer language for a beginner. Avoid jargon.'; break;
    case 'formal':    task = 'Rewrite in a more formal, professional tone.'; break;
    case 'continue':  task = 'Continue writing naturally from where this passage ends. The "result" must be ONLY the new continuation, not the original text.'; break;
    case 'custom':    task = `Apply this instruction to the selected text: "${instruction}".`; break;
    default:          task = ''; break;
  }
  return `${TEXT_BASE} ${task}${selected}${shape}`;
}

const FORMAT_SHAPES: Record<Format, string> = {
  callout:   '{"variant": "note|tip|warning|info|success", "title": "...", "body": "..."}',
  quiz:      '{"question": "...", "options": ["...", "..."], "correctIndex": 0, "explanation": "..."}',
  flashcards: '{"cards": [{"front": "...", "back": "..."}]}',
  steps:     '{"steps": [{"title": "...", "body": "..."}]}',
  accordion: '{"sections": [{"title": "...", "body": "..."}]}',
  tabs:      '{"tabs": [{"label": "...", "body": "..."}]}',
  carousel:  '{"slides": [{"title": "...", "body": "..."}]}',
  timeline:  '{"entries": [{"date": "...", "title": "...", "body": "..."}]}',
};

export function formatPrompt(format: Format, text: string, context: string): string {
  const ctx = context ? `\n\nSurrounding lesson context (for grounding only):\n"""${context}"""` : '';
  const sel = `\n\nSelected lesson text:\n"""${text}"""${ctx}`;
  const lead = 'You are turning a passage of an interactive lesson into a structured interactive block. Plain text only, no markdown.';
  let task: string;
  switch (format) {
    case 'callout':    task = 'Rewrite the selection as a single callout. Choose a variant from note, tip, warning, info, or success that best fits the content. Give it a short title and a body.'; break;
    case 'quiz':       task = 'Write one multiple-choice knowledge-check question that tests the key idea. Provide 3 or 4 options with exactly one correct answer; set correctIndex to its 0-based index, and write a short explanation.'; break;
    case 'flashcards': task = 'Create 3 to 6 flashcards. Each card has a short front (a term, question, or prompt) and a back (the definition or answer).'; break;
    case 'steps':      task = 'Break the process described into ordered steps. Each step has a short title and a one or two sentence body.'; break;
    case 'accordion':  task = 'Organize the content into 2 to 6 titled collapsible sections (like an FAQ or grouped key points). Each section has a short title and a body.'; break;
    case 'tabs':       task = 'Split the content into 2 to 5 tabs. Each tab has a short label and a body. Use tabs for parallel topics, comparisons, or examples.'; break;
    case 'carousel':   task = 'Turn the content into 3 to 6 carousel slides. Each slide has a short title and a body, suitable for stepping through one idea at a time.'; break;
    case 'timeline':   task = 'Extract the chronological events into timeline entries. Each entry has a date or period, a short title, and a brief body.'; break;
  }
  return `${lead} ${task}${sel}\n\nRespond as JSON: ${FORMAT_SHAPES[format]}`;
}

export function classifyPrompt(text: string, context: string): string {
  const ctx = context ? `\n\nSurrounding context:\n"""${context}"""` : '';
  return (
    'Look at the selected lesson text and choose the single best interactive format to present it. ' +
    'Options: "callout" (highlight a note/tip/warning), "quiz" (test understanding), ' +
    '"flashcards" (terms/definitions or Q&A), "steps" (a process or procedure), ' +
    '"accordion" (grouped sections or FAQ), "tabs" (parallel topics or comparisons), ' +
    '"carousel" (step through ideas one slide at a time), "timeline" (chronological events).' +
    `\n\nSelected text:\n"""${text}"""${ctx}` +
    '\n\nRespond as JSON: {"format": "<one of: callout, quiz, flashcards, steps, accordion, tabs, carousel, timeline>"}'
  );
}

// ---- Validation / normalization ---

const str = (v: unknown) => String(v ?? '').trim();
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const objArr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** Validate + normalize the model output for a format. Returns null if unusable. */
export function normalize(format: Format, raw: Record<string, unknown>): Record<string, unknown> | null {
  switch (format) {
    case 'callout': {
      const variant = CALLOUT_VARIANTS.has(str(raw.variant)) ? str(raw.variant) : 'note';
      const title = str(raw.title);
      const body = str(raw.body);
      if (!title && !body) return null;
      return { variant, title, body };
    }
    case 'quiz': {
      const question = str(raw.question);
      const options = strArr(raw.options);
      const correctIndex = Number(raw.correctIndex ?? 0);
      const explanation = str(raw.explanation);
      if (!question || options.length < 2 || !(correctIndex >= 0 && correctIndex < options.length)) return null;
      return { question, options, correctIndex, explanation };
    }
    case 'flashcards': {
      const cards = objArr(raw.cards)
        .map((c) => ({ front: str(c.front), back: str(c.back) }))
        .filter((c) => c.front && c.back);
      return cards.length ? { cards } : null;
    }
    case 'steps': {
      const steps = objArr(raw.steps)
        .map((s) => ({ title: str(s.title), body: str(s.body) }))
        .filter((s) => s.title || s.body);
      return steps.length ? { steps } : null;
    }
    case 'accordion': {
      const sections = objArr(raw.sections)
        .map((s) => ({ title: str(s.title), body: str(s.body) }))
        .filter((s) => s.title || s.body);
      return sections.length ? { sections } : null;
    }
    case 'tabs': {
      const tabs = objArr(raw.tabs)
        .map((t, i) => ({ label: str(t.label) || `Tab ${i + 1}`, body: str(t.body) }))
        .filter((t) => t.body);
      return tabs.length ? { tabs } : null;
    }
    case 'carousel': {
      const slides = objArr(raw.slides)
        .map((s) => ({ title: str(s.title), body: str(s.body) }))
        .filter((s) => s.title || s.body);
      return slides.length ? { slides } : null;
    }
    case 'timeline': {
      const entries = objArr(raw.entries)
        .map((e) => ({ date: str(e.date), title: str(e.title), body: str(e.body) }))
        .filter((e) => e.date || e.title || e.body);
      return entries.length ? { entries } : null;
    }
  }
}
