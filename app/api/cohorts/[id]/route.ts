import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['admin', 'instructor', 'staff']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { id } = await params;

  const payload: Record<string, string | null> = {};
  if ('name' in body) {
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Cohort name is required.' }, { status: 400 });
    payload.name = name;
  }
  if ('description' in body) payload.description = String(body.description ?? '').trim() || null;
  if ('start_date' in body) payload.start_date = body.start_date ? String(body.start_date) : null;
  if ('end_date' in body) payload.end_date = body.end_date ? String(body.end_date) : null;

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No editable cohort fields provided.' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('cohorts')
    .select('id, created_by')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Cohort not found.' }, { status: 404 });
  if (profile.role === 'instructor' && existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('cohorts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[api/cohorts] update error:', error.message);
    return NextResponse.json({ error: 'Failed to update cohort.' }, { status: 500 });
  }

  return NextResponse.json({ cohort: data });
}
