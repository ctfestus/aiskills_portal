import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 86400;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authenticate(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { userId: user.id };
}

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key   = `rate:ve-answer-review:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) {
      return NextResponse.json(
        { error: `Limit reached: ${RATE_LIMIT} AI reviews per day. Try again tomorrow.` },
        { status: 429 },
      );
    }
  } catch {
    // fail open if Redis is unavailable
  }
  return null;
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey });
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    score:    { type: Type.NUMBER },
    passed:   { type: Type.BOOLEAN },
    feedback: { type: Type.STRING },
  },
  required: ['score', 'passed', 'feedback'],
};

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const rateLimitError = await checkRateLimit(auth.userId);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const { question, description, studentAnswer, context, rubric, expectedAnswer, projectContext } = body;

  if (!studentAnswer?.trim()) {
    return NextResponse.json({ error: 'No answer submitted.' }, { status: 400 });
  }
  if (typeof studentAnswer !== 'string' || studentAnswer.length > 500) {
    return NextResponse.json({ error: 'Answer must be 500 characters or fewer.' }, { status: 400 });
  }

  const { company, role, industry, moduleTitle, lessonTitle } = projectContext ?? {};

  const roleLine    = (role && company) ? `${role} at ${company}` : role || company || 'a professional';
  const taskLabel   = question || description || 'this task';
  const lessonLine  = [moduleTitle, lessonTitle].filter(Boolean).join(' > ');

  const rubricLines = Array.isArray(rubric) && rubric.length > 0
    ? `Criteria: ${rubric.join(' | ')}`
    : '';
  const contextLine  = context       ? `Context: ${context}` : '';
  const modelLine    = expectedAnswer ? `Strong answer covers: ${expectedAnswer}` : '';
  const extras       = [contextLine, rubricLines, modelLine].filter(Boolean).join('\n');

  const prompt = `You are a senior ${roleLine}${industry ? ` in ${industry}` : ''}. A junior team member has submitted a written response as part of their work experience${lessonLine ? ` (${lessonLine})` : ''}.

Task: ${taskLabel}
${extras ? `\n${extras}\n` : ''}
Their response: "${studentAnswer}"

Score 0-100 (60+ passes). Write exactly 2-3 sentences of feedback. Rules:
- Be direct. Cut any sentence that does not add information.
- Reference what they actually wrote, not generic advice.
- If passed: name one specific strength, then one concrete way to go further.
- If not passed: name the exact gap, explain why it matters on the job, tell them precisely what to add or change.
- No preamble. No filler phrases ("great effort", "however", "it's worth noting"). No bullet points. Start with the assessment, not their name.`;

  try {
    const ai    = getAI();
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.4,
      },
    });

    const parsed = JSON.parse(result.text ?? '{}');
    return NextResponse.json({
      passed:   !!parsed.passed,
      feedback: parsed.feedback || '',
      score:    typeof parsed.score === 'number' ? Math.round(parsed.score) : 0,
    });
  } catch (err: any) {
    console.error('[ve-answer-review]', err);
    return NextResponse.json({ error: 'AI review failed. Please try again.' }, { status: 500 });
  }
}
