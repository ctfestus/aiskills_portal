import { Type } from '@google/genai';
import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';

// Inline "Ask AI" assistant for the authoring editors (lesson / VE / assignment).
// Acts on a SELECTION the instructor made -- distinct from the bulk generators
// (/api/ai-course, /api/ai-guided-project) which scaffold whole fields. Instructor/admin only.
//
// Text actions return { result: string }. Interactive actions return
// { kind: InteractiveKind, interactive: <payload> } -- one payload shape per lesson node type.
// make_auto classifies the selection server-side, then generates the chosen format.
// Plain-ASCII output is enforced globally by FORMATTING_SYSTEM_INSTRUCTION in lib/ai.

const TEXT_ACTIONS = new Set([
  'improve', 'expand', 'summarize', 'shorten', 'grammar', 'simplify', 'formal', 'continue', 'custom',
]);
const FORMATS = ['callout', 'quiz', 'flashcards', 'steps', 'accordion', 'tabs', 'carousel', 'timeline'] as const;
type Format = typeof FORMATS[number];
const FORMAT_SET = new Set<string>(FORMATS);
const INTERACTIVE_ACTIONS = new Set<string>(['make_auto', ...FORMATS.map((f) => `make_${f}`)]);
const ALLOWED_ACTIONS = new Set<string>([...TEXT_ACTIONS, ...INTERACTIVE_ACTIONS]);

const CALLOUT_VARIANTS = new Set(['note', 'tip', 'warning', 'info', 'success']);

const MAX_TEXT = 6000;
const MAX_INSTRUCTION = 500;
const MAX_CONTEXT = 1500;

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) {
    // Fail closed -- AI is a paid feature, don't allow through if limiter is down
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  try {
    const key   = `rate:ai-assist:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600); // 1-hour window
    if (count > 40) {
      return NextResponse.json(
        { error: 'AI assist limit reached. You can make up to 40 edits per hour.' },
        { status: 429 },
      );
    }
  } catch {
    // Redis error -- fail closed
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  return null;
}

// ---- Text actions ---

const BASE =
  'You are editing one passage of an interactive lesson for an online learning platform. ' +
  'Return ONLY the rewritten passage as plain text in the "result" field -- no preamble, ' +
  'no surrounding quotes, no markdown code fences. Preserve the meaning and the author\'s voice. ' +
  'Keep roughly the same paragraph structure unless the instruction says otherwise.';

function buildTextPrompt(action: string, text: string, instruction: string, context: string): string {
  const ctx = context
    ? `\n\nSurrounding lesson context (for tone only -- do not rewrite or repeat it):\n"""${context}"""`
    : '';
  const selected = `\n\nSelected text:\n"""${text}"""${ctx}`;
  switch (action) {
    case 'improve':   return `${BASE} Improve clarity, flow, and word choice without changing the meaning.${selected}`;
    case 'expand':    return `${BASE} Expand with one or two more sentences of useful detail or a brief example. Stay concise.${selected}`;
    case 'summarize': return `${BASE} Summarize into a shorter version that keeps the key points.${selected}`;
    case 'shorten':   return `${BASE} Make it noticeably shorter and tighter while keeping the meaning.${selected}`;
    case 'grammar':   return `${BASE} Fix spelling and grammar only. Do not change the wording or style beyond what is needed for correctness.${selected}`;
    case 'simplify':  return `${BASE} Rewrite in simpler, plainer language for a beginner. Avoid jargon.${selected}`;
    case 'formal':    return `${BASE} Rewrite in a more formal, professional tone.${selected}`;
    case 'continue':  return `${BASE} Continue writing naturally from where this passage ends. Return ONLY the new continuation, not the original text.${selected}`;
    case 'custom':    return `${BASE} Apply this instruction to the selected text: "${instruction}".${selected}`;
    default:          return `${BASE}${selected}`;
  }
}

// ---- Interactive formats ---

const ITEM = (props: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties: props, required });
const STR = { type: Type.STRING };
const STR_ARR = (props: Record<string, unknown>, required: string[]) => ({ type: Type.ARRAY, items: ITEM(props, required) });

const SCHEMAS: Record<Format, unknown> = {
  callout:   ITEM({ variant: STR, title: STR, body: STR }, ['variant', 'title', 'body']),
  quiz:      ITEM({ question: STR, options: { type: Type.ARRAY, items: STR }, correctIndex: { type: Type.INTEGER }, explanation: STR }, ['question', 'options', 'correctIndex', 'explanation']),
  flashcards: ITEM({ cards: STR_ARR({ front: STR, back: STR }, ['front', 'back']) }, ['cards']),
  steps:     ITEM({ steps: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['steps']),
  accordion: ITEM({ sections: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['sections']),
  tabs:      ITEM({ tabs: STR_ARR({ label: STR, body: STR }, ['label', 'body']) }, ['tabs']),
  carousel:  ITEM({ slides: STR_ARR({ title: STR, body: STR }, ['title', 'body']) }, ['slides']),
  timeline:  ITEM({ entries: STR_ARR({ date: STR, title: STR, body: STR }, ['date', 'title', 'body']) }, ['entries']),
};

function formatPrompt(format: Format, text: string, context: string): string {
  const ctx = context ? `\n\nSurrounding lesson context (for grounding only):\n"""${context}"""` : '';
  const sel = `\n\nSelected lesson text:\n"""${text}"""${ctx}`;
  const lead = 'You are turning a passage of an interactive lesson into a structured interactive block. Plain text only, no markdown.';
  switch (format) {
    case 'callout':    return `${lead} Rewrite the selection as a single callout. Choose a variant from note, tip, warning, info, or success that best fits the content. Give it a short title and a body.${sel}`;
    case 'quiz':       return `${lead} Write one multiple-choice knowledge-check question that tests the key idea. Provide 3 or 4 options with exactly one correct answer; set correctIndex to its 0-based index, and write a short explanation.${sel}`;
    case 'flashcards': return `${lead} Create 3 to 6 flashcards. Each card has a short front (a term, question, or prompt) and a back (the definition or answer).${sel}`;
    case 'steps':      return `${lead} Break the process described into ordered steps. Each step has a short title and a one or two sentence body.${sel}`;
    case 'accordion':  return `${lead} Organize the content into 2 to 6 titled collapsible sections (like an FAQ or grouped key points). Each section has a short title and a body.${sel}`;
    case 'tabs':       return `${lead} Split the content into 2 to 5 tabs. Each tab has a short label and a body. Use tabs for parallel topics, comparisons, or examples.${sel}`;
    case 'carousel':   return `${lead} Turn the content into 3 to 6 carousel slides. Each slide has a short title and a body, suitable for stepping through one idea at a time.${sel}`;
    case 'timeline':   return `${lead} Extract the chronological events into timeline entries. Each entry has a date or period, a short title, and a brief body.${sel}`;
  }
}

function classifyPrompt(text: string, context: string): string {
  const ctx = context ? `\n\nSurrounding context:\n"""${context}"""` : '';
  return (
    'Look at the selected lesson text and choose the single best interactive format to present it. ' +
    'Options: "callout" (highlight a note/tip/warning), "quiz" (test understanding), ' +
    '"flashcards" (terms/definitions or Q&A), "steps" (a process or procedure), ' +
    '"accordion" (grouped sections or FAQ), "tabs" (parallel topics or comparisons), ' +
    '"carousel" (step through ideas one slide at a time), "timeline" (chronological events). ' +
    `Return only the format as a single lowercase word.\n\nSelected text:\n"""${text}"""${ctx}`
  );
}

const str = (v: unknown) => String(v ?? '').trim();
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const objArr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

// Validate + normalize the model output for a format. Returns null if unusable.
function normalize(format: Format, raw: Record<string, unknown>): Record<string, unknown> | null {
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

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'admin']);
  if (isAuthError(auth)) return auth.error;

  const limited = await checkRateLimit(auth.user.id);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const text = String(body?.text ?? '');
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'Selection is too long. Select a smaller passage.' }, { status: 413 });
  }
  if (action !== 'continue' && !text.trim()) {
    return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 });
  }

  const instruction = String(body?.instruction ?? '').slice(0, MAX_INSTRUCTION);
  if (action === 'custom' && !instruction.trim()) {
    return NextResponse.json({ error: 'Enter an instruction.' }, { status: 400 });
  }
  const context = String(body?.contextText ?? '').slice(0, MAX_CONTEXT);

  try {
    if (INTERACTIVE_ACTIONS.has(action)) {
      let format: Format;
      if (action === 'make_auto') {
        const cls = await generateJSON(
          classifyPrompt(text, context),
          ITEM({ format: STR }, ['format']),
          { temperature: 0.2 },
        );
        const picked = str(cls?.format).toLowerCase();
        format = (FORMAT_SET.has(picked) ? picked : 'quiz') as Format;
      } else {
        format = action.replace('make_', '') as Format;
      }

      const raw = await generateJSON(formatPrompt(format, text, context), SCHEMAS[format], { temperature: 0.6 });
      const payload = normalize(format, raw ?? {});
      if (!payload) {
        return NextResponse.json({ error: 'Could not build that block from the selection. Try a longer or different passage.' }, { status: 502 });
      }
      return NextResponse.json({ kind: format, interactive: payload });
    }

    const out = await generateJSON(
      buildTextPrompt(action, text, instruction, context),
      ITEM({ result: STR }, ['result']),
      { temperature: action === 'grammar' ? 0.2 : 0.6 },
    );
    const result = String(out?.result ?? '').trim();
    if (!result) {
      return NextResponse.json({ error: 'No result generated. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    console.warn('[ai-assist] failed:', (e as Error).message);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 502 });
  }
}
