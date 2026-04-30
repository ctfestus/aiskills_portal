import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

// GET /api/ve-for-assignment?veId=xxx
// Returns VE config using the service-role client so RLS never blocks a student
// who has access to an assignment that embeds this VE.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const veId = new URL(req.url).searchParams.get('veId');
  if (!veId) return NextResponse.json({ error: 'veId required' }, { status: 400 });

  const { data: ve, error } = await adminClient()
    .from('virtual_experiences')
    .select('id, title, slug, modules, company, role, industry, tagline, cover_image, manager_name, manager_title, dataset, background')
    .eq('id', veId)
    .single();

  if (error || !ve) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ve });
}
