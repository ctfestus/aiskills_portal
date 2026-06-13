import { NextRequest, NextResponse } from 'next/server';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);


// GET /api/ve-for-assignment?veId=xxx
// Returns VE config using the service-role client so RLS never blocks a student
// who has access to an assignment that embeds this VE.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;

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
