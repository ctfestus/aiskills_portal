import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import {
  ALLOWED_ACTIONS, INTERACTIVE_ACTIONS, FORMAT_SET, MAX_TEXT, MAX_INSTRUCTION, MAX_CONTEXT,
  SCHEMAS, TEXT_SCHEMA, FORMAT_PICK_SCHEMA,
  buildTextPrompt, formatPrompt, classifyPrompt, normalize, type Format,
} from '@/lib/ai-assist-server';

// Inline "Ask AI" assistant for the authoring editors (lesson / VE / assignment).
// Acts on a SELECTION the instructor made -- distinct from the bulk generators
// (/api/ai-course, /api/ai-guided-project) which scaffold whole fields. Instructor/admin only.
//
// Text actions return { result: string }. Interactive actions return
// { kind: InteractiveKind, interactive: <payload> } -- one payload shape per lesson node type.
// make_auto classifies the selection server-side, then generates the chosen format.
// Prompt construction, schemas, and validation live in lib/ai-assist-server (unit-tested).

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
        const cls = await generateJSON(classifyPrompt(text, context), FORMAT_PICK_SCHEMA, { temperature: 0.2 });
        const picked = String(cls?.format ?? '').trim().toLowerCase();
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

    const out = await generateJSON(buildTextPrompt(action, text, instruction, context), TEXT_SCHEMA, { temperature: action === 'grammar' ? 0.2 : 0.6 });
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
