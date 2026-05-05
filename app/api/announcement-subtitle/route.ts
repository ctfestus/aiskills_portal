import { Type } from '@google/genai';
import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const schema = {
  type: Type.OBJECT,
  properties: { subtitle: { type: Type.STRING } },
  required: ['subtitle'],
};

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient().from('students').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'instructor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw: string = (body?.content ?? '').toString();
  if (!raw.trim()) return NextResponse.json({ error: 'No content provided' }, { status: 400 });

  // Strip HTML tags for the prompt
  const plainText = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  if (!plainText) return NextResponse.json({ error: 'No readable content found' }, { status: 400 });

  const prompt = `You are a sharp tech blog editor. Based on the article content below, write ONE short subtitle for a blog post card preview. Requirements:
- Maximum 120 characters
- Catchy, punchy and curiosity-provoking
- Plain English, no jargon unless the article is technical
- No dashes of any kind, no ellipsis, no curly quotes, no angle brackets, no asterisks, no hashtags, and no non-standard punctuation
- Use only regular letters, numbers, commas, periods, exclamation marks, question marks, colons, and plain apostrophes
- Do not start with the same word as the title
- Return ONLY the subtitle text, no quotes around it

Article content:
${plainText}`;

  try {
    const result = await generateJSON(prompt, schema, { temperature: 0.8 });
    const subtitle = (result.subtitle ?? '').trim().slice(0, 200);
    return NextResponse.json({ subtitle });
  } catch (err: any) {
    console.error('[announcement-subtitle]', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
