import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ColumnInfo { name: string; type?: string }
interface TableInfo  { tableName: string; columns: ColumnInfo[] }

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

async function getSessionUser(req: NextRequest): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  return user?.id ? { id: user.id } : null;
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
