import { generateJSON } from '@/lib/ai';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import { bumpRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 3600;

interface ColumnInfo { name: string; type?: string }
interface TableInfo  { tableName: string; columns: ColumnInfo[] }

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

async function getSessionUser(req: NextRequest): Promise<{ id: string } | null> {
  const auth = await requireUser(req);
  return isAuthError(auth) ? null : { id: auth.user.id };
}

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });

  try {
    const key = `rate:sql-ai:${userId}`;
    if (await bumpRateLimit(redis, key, RATE_LIMIT, RATE_WINDOW_SECONDS)) {
      const ttl = await redis.ttl(key).catch(() => RATE_WINDOW_SECONDS);
      const retryAfter = Math.max(1, ttl > 0 ? ttl : RATE_WINDOW_SECONDS);
      return NextResponse.json(
        { error: `SQL AI limit reached. You can make up to ${RATE_LIMIT} requests per hour.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  return null;
}

function schemaText(tables: TableInfo[]): string {
  if (!tables?.length) return '';
  return tables.map(t =>
    `Table "${t.tableName}": ${t.columns.map(c => c.type ? `${c.name} (${c.type})` : c.name).join(', ')}`
  ).join('\n');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, query, error, task, tables, lessonContext } = await req.json();
    const schema = schemaText(tables ?? []);

    if (action !== 'explain-error' && action !== 'hint') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const rateLimitError = await checkRateLimit(sessionUser.id);
    if (rateLimitError) return rateLimitError;

    if (action === 'explain-error') {
      const prompt = `You are a helpful SQL tutor for beginners. A student ran this SQL query and got an error.

Query:
\`\`\`sql
${query || '(empty)'}
\`\`\`

Error message:
${error}

${schema ? `Available tables:\n${schema}\n` : ''}
Explain what went wrong in 1-2 plain English sentences a beginner can understand. Be specific about what in their query caused the problem. Do not give the corrected query, just explain the error clearly.

Return JSON: { "explanation": "..." }`;

      const result = await generateJSON(prompt, undefined, { temperature: 0.3 });
      return NextResponse.json({ explanation: result.explanation ?? '' });
    }

    if (action === 'hint') {
      const context = lessonContext ? stripHtml(lessonContext).substring(0, 600) : '';
      const prompt = `You are a helpful SQL tutor. A student is working on this exercise.

Task: ${task || 'Write a SQL query to solve the problem.'}

Their current query:
\`\`\`sql
${query?.trim() || '(nothing written yet)'}
\`\`\`

${schema ? `Available tables:\n${schema}\n` : ''}${context ? `Lesson context: ${context}\n` : ''}
Give a specific, actionable hint that nudges them toward the solution without revealing it. 1-2 sentences. If their query is empty, suggest where to start. If they have something written, comment on what's missing or wrong.

Return JSON: { "hint": "..." }`;

      const result = await generateJSON(prompt, undefined, { temperature: 0.4 });
      return NextResponse.json({ hint: result.hint ?? '' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[sql-ai]', err);
    return NextResponse.json({ error: 'AI unavailable. Please try again.' }, { status: 500 });
  }
}
