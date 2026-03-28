import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminClient().auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { editId, title, config, coverImage, cohort_ids } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!config)        return NextResponse.json({ error: 'Config is required' }, { status: 400 });

  const finalConfig = { ...config, isVirtualExperience: true, coverImage: coverImage || config.coverImage || '' };

  const payload: any = {
    title:        title.trim(),
    config:       finalConfig,
    cohort_ids:   Array.isArray(cohort_ids) ? cohort_ids : [],
    content_type: 'virtual_experience',
    description:  config.tagline || '',
  };

  if (editId) {
    // Fetch current cohort_ids before updating so we can detect newly added cohorts
    const { data: existing } = await adminClient()
      .from('forms')
      .select('cohort_ids, slug')
      .eq('id', editId)
      .eq('user_id', user.id)
      .single();

    const { error } = await adminClient()
      .from('forms')
      .update(payload)
      .eq('id', editId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[guided-project-save] update error:', error);
      return NextResponse.json({ error: `${error.message} (code: ${error.code})` }, { status: 500 });
    }

    // Notify students in cohorts that were newly added in this edit
    const oldCohortIds: string[] = Array.isArray(existing?.cohort_ids) ? existing.cohort_ids : [];
    const newCohortIds: string[] = payload.cohort_ids;
    const addedCohortIds = newCohortIds.filter(id => !oldCohortIds.includes(id));
    if (addedCohortIds.length && existing?.slug) {
      sendAssignmentNotifications({
        cohortIds: addedCohortIds,
        title: title.trim(),
        slug: existing.slug,
        contentType: 'virtual_experience',
      }).catch(() => {});
    }

    return NextResponse.json({ id: editId });
  }

  // Generate slug
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug  = `${base}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await adminClient()
    .from('forms')
    .insert({ ...payload, slug, user_id: user.id })
    .select('id, slug')
    .single();

  if (error) {
    console.error('[guided-project-save] insert error:', error);
    return NextResponse.json({ error: `${error.message} (code: ${error.code})` }, { status: 500 });
  }

  // Fire-and-forget assignment notifications to cohort students
  if (payload.cohort_ids.length) {
    sendAssignmentNotifications({
      cohortIds: payload.cohort_ids,
      title: title.trim(),
      slug: data.slug,
      contentType: 'virtual_experience',
    }).catch(() => {});
  }

  return NextResponse.json({ id: data.id, slug: data.slug });
}
