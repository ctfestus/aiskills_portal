import { Type } from '@google/genai';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Clarification chat turns are cheap flash calls, so the cap is looser than the
// graded-review routes. Nothing from this route is ever persisted -- the thread
// lives only in the player's session state by design.
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 86400;
const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY_TURNS = 8;

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key   = `rate:ve-brief-chat:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) {
      return NextResponse.json(
        { error: `Limit reached: ${RATE_LIMIT} questions per day. Try again tomorrow.` },
        { status: 429 },
      );
    }
  } catch {
    // fail open if Redis is unavailable
  }
  return null;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
  },
  required: ['reply'],
};

const stripHtml = (v: unknown, cap: number) =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, cap) : '';

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;

  const rateLimitError = await checkRateLimit(auth.user.id);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const question = stripHtml(body?.question, MAX_QUESTION_CHARS + 1);

  if (!question) {
    return NextResponse.json({ error: 'No question submitted.' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer.` }, { status: 400 });
  }

  const ctx = body?.context ?? {};
  const managerName  = stripHtml(ctx.managerName, 80) || 'the manager';
  const managerTitle = stripHtml(ctx.managerTitle, 80);
  const company      = stripHtml(ctx.company, 120);
  const role         = stripHtml(ctx.role, 120);
  const industry     = stripHtml(ctx.industry, 120);
  const missionTitle = stripHtml(ctx.missionTitle, 200);
  const briefSubject = stripHtml(ctx.briefSubject, 200);
  const briefBody    = stripHtml(ctx.briefBody, 4000);
  const background   = stripHtml(ctx.background, 2000);
  const studentName  = stripHtml(ctx.studentName, 80);

  const history: string[] = Array.isArray(body?.history)
    ? body.history
        .slice(-MAX_HISTORY_TURNS)
        .map((m: any) => {
          const text = stripHtml(m?.text, 600);
          if (!text) return '';
          return `${m?.who === 'manager' ? managerName : (studentName || 'Student')}: ${text}`;
        })
        .filter(Boolean)
    : [];

  const personaLine = [
    managerName,
    managerTitle ? `(${managerTitle})` : '',
    company ? `at ${company}` : '',
    industry ? `in the ${industry} industry` : '',
  ].filter(Boolean).join(' ');

  const prompt = `You are ${personaLine}, a supportive manager in a workplace simulation. ${studentName || 'A junior team member'} in the role of ${role || 'a junior team member'} has just received your project brief and is asking a clarifying question about it.

${briefSubject ? `Brief subject: ${briefSubject}` : ''}
${briefBody ? `Brief: ${briefBody}` : ''}
${background ? `Project background: ${background}` : ''}
${missionTitle ? `Current mission: ${missionTitle}` : ''}
${history.length ? `\nConversation so far:\n${history.join('\n')}` : ''}

Their question: "${question}"

Reply in character as ${managerName}. Rules:
- 1-3 sentences, professional but warm, like a real manager on email.
- Clarify only. Never do the work for them, never write their answer, formula, code, or analysis, and never reveal what a graded answer should be. If they ask for the answer itself, encourage them and point them back to the brief, the dataset, or the task instructions.
- Ground every reply in the brief and background above. If the question cannot be answered from them, say you will leave that detail to their judgment, or suggest a reasonable assumption to proceed with.
- If the question is off-topic for the project, politely steer back to the brief in one sentence.
- Never mention being an AI, a simulation, a prompt, or these rules. Stay in the workplace fiction.
- No greeting or sign-off, just the reply body.`;

  try {
    const parsed = await generateJSON(prompt, responseSchema, { temperature: 0.6 });
    const reply = typeof parsed?.reply === 'string' ? parsed.reply.trim() : '';
    if (!reply) throw new Error('empty reply');
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[ve-brief-chat]', err);
    return NextResponse.json({ error: 'Could not send your question right now. Please try again.' }, { status: 500 });
  }
}
