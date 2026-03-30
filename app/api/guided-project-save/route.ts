import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

export const dynamic = 'force-dynamic';

async function upsertCohortAssignments(supabase: ReturnType<typeof adminClient>, formId: string, cohortIds: string[]) {
  if (!cohortIds.length) return;
  const rows = cohortIds.map(cohortId => ({ form_id: formId, cohort_id: cohortId }));
  const { error } = await supabase
    .from('cohort_assignments')
    .upsert(rows, { onConflict: 'form_id,cohort_id', ignoreDuplicates: true });
  if (error) console.error('[cohort_assignments] upsert error:', error.message, error.code);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { editId, title, config, coverImage, cohort_ids, deadline_days, status: bodyStatus } = body;
  const formStatus = bodyStatus === 'draft' ? 'draft' : 'published';
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!config)        return NextResponse.json({ error: 'Config is required' }, { status: 400 });

  const finalConfig = {
    ...config,
    isVirtualExperience: true,
    coverImage: coverImage || config.coverImage || '',
    deadline_days: deadline_days ? Number(deadline_days) : (config.deadline_days ?? null),
  };

  const newCohortIds: string[] = Array.isArray(cohort_ids) ? cohort_ids : [];

  const payload: any = {
    title:        title.trim(),
    config:       finalConfig,
    cohort_ids:   newCohortIds,
    content_type: 'virtual_experience',
    description:  config.tagline || '',
    status:       formStatus,
  };

  if (editId) {
    // Fetch current cohort_ids before updating so we can detect newly added cohorts
    const { data: existing } = await supabase
      .from('forms')
      .select('cohort_ids, slug')
      .eq('id', editId)
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('forms')
      .update(payload)
      .eq('id', editId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[guided-project-save] update error:', error);
      return NextResponse.json({ error: 'Failed to save project.' }, { status: 500 });
    }

    // Upsert cohort_assignments for all current cohorts (preserves original assigned_at)
    console.log('[guided-project-save] upserting cohort_assignments for', newCohortIds.length, 'cohorts, formId:', editId);
    await upsertCohortAssignments(supabase, editId, newCohortIds);

    // Notify students in cohorts that were newly added in this edit
    const oldCohortIds: string[] = Array.isArray(existing?.cohort_ids) ? existing.cohort_ids : [];
    const addedCohortIds = newCohortIds.filter(id => !oldCohortIds.includes(id));
    if (addedCohortIds.length && existing?.slug) {
      sendAssignmentNotifications({
        cohortIds: addedCohortIds,
        title: title.trim(),
        slug: existing.slug,
        contentType: 'virtual_experience',
      }).catch(() => {});
    }

    // Re-index in vector DB so search/recommendations stay current
    if (formStatus === 'published') {
      fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
        body:    JSON.stringify({ formId: editId }),
      }).catch(() => {});
    }

    return NextResponse.json({ id: editId });
  }

  // Generate slug
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug  = `${base}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from('forms')
    .insert({ ...payload, slug, user_id: user.id })
    .select('id, slug')
    .single();

  if (error) {
    console.error('[guided-project-save] insert error:', error);
    return NextResponse.json({ error: `${error.message} (code: ${error.code})` }, { status: 500 });
  }

  // Upsert cohort_assignments for all assigned cohorts
  await upsertCohortAssignments(supabase, data.id, newCohortIds);

  // Fire-and-forget assignment notifications to cohort students
  if (newCohortIds.length) {
    sendAssignmentNotifications({
      cohortIds: newCohortIds,
      title: title.trim(),
      slug: data.slug,
      contentType: 'virtual_experience',
    }).catch(() => {});
  }

  // Index in vector DB for semantic search/recommendations
  if (formStatus === 'published') {
    fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
      body:    JSON.stringify({ formId: data.id }),
    }).catch(() => {});
  }

  return NextResponse.json({ id: data.id, slug: data.slug });
}
