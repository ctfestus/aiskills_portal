/**
 * POST /api/vector/trigger-index
 * Client-safe proxy for instructors/admins to trigger vector indexing.
 * Verifies the caller owns the form, then calls index-course internally
 * with the REINDEX_SECRET -- secret never reaches the browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // 1. Verify caller is an authenticated instructor or admin
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['instructor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse and validate formId
  let formId: string;
  try {
    ({ formId } = await req.json());
    if (!formId) throw new Error();
  } catch {
    return NextResponse.json({ error: 'formId required' }, { status: 400 });
  }

  // 3. Verify the caller owns this content (courses, events, or virtual_experiences)
  const [{ data: course }, { data: eventRow }, { data: ve }] = await Promise.all([
    supabase.from('courses').select('user_id').eq('id', formId).maybeSingle(),
    supabase.from('events').select('user_id').eq('id', formId).maybeSingle(),
    supabase.from('virtual_experiences').select('user_id').eq('id', formId).maybeSingle(),
  ]);
  const content = course ?? eventRow ?? ve;
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (content.user_id !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Forward to internal index-course with secret (server-to-server)
  const appUrl = process.env.APP_URL || '';
  const secret = process.env.REINDEX_SECRET ?? '';
  const res = await fetch(`${appUrl}/api/vector/index-course`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-reindex-secret': secret },
    body:    JSON.stringify({ formId }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
