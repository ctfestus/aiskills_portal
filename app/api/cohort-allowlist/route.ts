/**
 * GET  ?email=EMAIL       -- public, check if email is on any allowlist
 * GET  ?cohortId=UUID     -- admin-auth, list all emails for a cohort
 * POST                    -- admin-auth, add emails to a cohort allowlist
 * DELETE                  -- admin-auth, remove an email entry by id
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

async function requireInstructor(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return null;
  const { data: student } = await adminClient()
    .from('students').select('role').eq('id', user.id).maybeSingle();
  if (!student || !['admin', 'instructor'].includes(student.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email    = searchParams.get('email');
  const cohortId = searchParams.get('cohortId');

  // --- Public: check if an email is allowed ---
  if (email) {
    const { data } = await adminClient()
      .from('cohort_allowed_emails')
      .select('cohort_id, cohorts(name)')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!data) return NextResponse.json({ allowed: false });
    return NextResponse.json({
      allowed: true,
      cohortId: data.cohort_id,
      cohortName: (data.cohorts as any)?.name ?? '',
    });
  }

  // --- Admin: list emails for a cohort ---
  if (cohortId) {
    const user = await requireInstructor(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await adminClient()
      .from('cohort_allowed_emails')
      .select('id, email, created_at')
      .eq('cohort_id', cohortId)
      .order('email');

    return NextResponse.json({ emails: data ?? [] });
  }

  return NextResponse.json({ error: 'Missing email or cohortId param' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const user = await requireInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cohortId, emails } = body;
  if (!cohortId || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'cohortId and emails[] are required' }, { status: 400 });
  }

  const rows = emails
    .map((e: string) => e.toLowerCase().trim())
    .filter((e: string) => e.includes('@'))
    .map((email: string) => ({ cohort_id: cohortId, email, added_by: user.id }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 });
  }

  let data: any, error: any;
  const insert = await adminClient()
    .from('cohort_allowed_emails')
    .insert(rows)
    .select('id, email, created_at');

  if (insert.error) {
    const upsert = await adminClient()
      .from('cohort_allowed_emails')
      .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
      .select('id, email, created_at');
    data = upsert.data;
    error = upsert.error;
  } else {
    data = insert.data;
    error = insert.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const user = await requireInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await adminClient()
    .from('cohort_allowed_emails')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
