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

export async function POST(req: NextRequest) {
  const userId = await getCallerUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider } = await req.json();
  if (!provider) return NextResponse.json({ error: 'Missing provider' }, { status: 400 });

  await adminSupabase.from('meeting_integrations').update({ connected: false, access_token: null, refresh_token: null }).eq('user_id', userId).eq('provider', provider);
  return NextResponse.json({ success: true });
}
