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

  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- Parse body ---
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, config, slug: preferredSlug, cohort_ids, deadline_days } = body;
  if (!config) return NextResponse.json({ error: 'config is required' }, { status: 400 });

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

    const { data, error } = await adminClient()
      .from('forms')
      .insert({ user_id: user.id, title, description, config: finalConfig, slug, content_type, cohort_ids: cohort_ids ?? [] })
      .select('id, slug, content_type')
      .single();

    if (!error) {
      // Upsert cohort_assignments (preserves original assigned_at on re-save)
      if (cohort_ids?.length) {
        const rows = (cohort_ids as string[]).map(cohortId => ({ form_id: data.id, cohort_id: cohortId }));
        adminClient()
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
      return NextResponse.json({ id: data.id, slug: data.slug, content_type: data.content_type });
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
