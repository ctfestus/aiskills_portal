import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCallerUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user.id;
}

export async function GET(req: NextRequest) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await adminSupabase
    .from('meeting_integrations')
    .select('provider, email, updated_at')
    .eq('user_id', userId)
    .eq('connected', true);

  const result: Record<string, { connected: boolean; email?: string; updatedAt: string }> = {};
  for (const row of data ?? []) {
    result[row.provider] = { connected: true, email: row.email, updatedAt: row.updated_at };
  }
  return NextResponse.json(result);
}
