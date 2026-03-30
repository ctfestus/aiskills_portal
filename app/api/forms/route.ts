import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/subscription';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

export const dynamic = 'force-dynamic';

function shortSlug() {
  // Use cryptographically secure random bytes -- Math.random() is predictable.
  // 5 bytes -> base64url gives 7 URL-safe chars from a ~1 trillion space.
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export async function POST(req: NextRequest) {
  // -- Auth ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- RBAC: only instructors and admins can create forms ---
  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!student || !['instructor', 'admin'].includes(student.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // -- Parse body ---
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, config, slug: preferredSlug, cohort_ids, deadline_days, status: bodyStatus } = body;
  if (!config) return NextResponse.json({ error: 'config is required' }, { status: 400 });

  const formStatus = bodyStatus === 'draft' ? 'draft' : 'published';

  // Detect content type from config -- platform only supports 'course' and 'event'
  const isCourse = Boolean(config?.isCourse);
  const isEvent  = Boolean(config?.eventDetails?.isEvent);
  if (!isCourse && !isEvent) {
    return NextResponse.json({ error: 'config must set isCourse or eventDetails.isEvent' }, { status: 400 });
  }
  const content_type = isCourse ? 'course' : 'event';

  let attempt = 0;
  let slug = preferredSlug?.trim() || shortSlug();

  while (attempt < 3) {
    if (attempt > 0) slug = shortSlug();

    const finalConfig = deadline_days
      ? { ...config, deadline_days: Number(deadline_days) }
      : config;

    const { data, error } = await supabase
      .from('forms')
      .insert({ user_id: user.id, title, description, config: finalConfig, slug, content_type, cohort_ids: cohort_ids ?? [], status: formStatus })
      .select('id, slug, content_type, status')
      .single();

    if (!error) {
      // Upsert cohort_assignments (preserves original assigned_at on re-save)
      if (cohort_ids?.length) {
        const rows = (cohort_ids as string[]).map(cohortId => ({ form_id: data.id, cohort_id: cohortId }));
        supabase
          .from('cohort_assignments')
          .upsert(rows, { onConflict: 'form_id,cohort_id', ignoreDuplicates: true })
          .then();
      }
      // Fire-and-forget assignment notifications to cohort students
      if (cohort_ids?.length) {
        sendAssignmentNotifications({
          cohortIds: cohort_ids,
          title: title || '',
          slug: data.slug,
          contentType: content_type,
        }).catch(() => {});
      }
      // Index in vector DB for semantic search/recommendations (only published courses)
      if (formStatus === 'published' && isCourse) {
        fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
          body:    JSON.stringify({ formId: data.id }),
        }).catch(() => {});
      }
      return NextResponse.json({ id: data.id, slug: data.slug, content_type: data.content_type, status: data.status });
    }

    if (error.code === '23505') { attempt++; continue; }

    console.error('[api/forms] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  }

  return NextResponse.json(
    { error: 'Could not generate a unique URL. Try a custom slug.' },
    { status: 409 }
  );
}

export async function PATCH(req: NextRequest) {
  // Status toggle -- instructor/admin only, must own the form
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!profile || !['instructor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formId: string, status: string;
  try {
    ({ formId, status } = await req.json());
    if (!formId || !['draft', 'published'].includes(status)) throw new Error();
  } catch {
    return NextResponse.json({ error: 'formId and status required' }, { status: 400 });
  }

  // Verify ownership
  const { data: form } = await supabase.from('forms').select('user_id').eq('id', formId).single();
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (form.user_id !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase.from('forms').update({ status }).eq('id', formId);
  if (updateError) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });

  // Re-index when publishing (fire-and-forget)
  if (status === 'published') {
    fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
      body:    JSON.stringify({ formId }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  // -- Auth ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('id');
  if (!formId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Verify ownership -- only the creator (or an admin) can delete
  const { data: form } = await supabase.from('forms').select('id, user_id, config').eq('id', formId).single();
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  if (form.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete related records first
  await supabase.from('certificates').delete().eq('form_id', formId);
  await supabase.from('course_attempts').delete().eq('form_id', formId);
  await supabase.from('responses').delete().eq('form_id', formId);

  // Delete the form itself
  const { error: deleteError } = await supabase.from('forms').delete().eq('id', formId);
  if (deleteError) {
    console.error('[api/forms] delete error:', deleteError.message);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
