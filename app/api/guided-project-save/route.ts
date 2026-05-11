import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

export const dynamic = 'force-dynamic';

async function upsertCohortAssignments(supabase: ReturnType<typeof adminClient>, veId: string, cohortIds: string[]) {
  if (!cohortIds.length) return;
  const rows = cohortIds.map(cohortId => ({
    content_type: 'virtual_experience',
    content_id:   veId,
    cohort_id:    cohortId,
  }));
  const { error } = await supabase
    .from('cohort_assignments')
    .upsert(rows, { onConflict: 'content_id,cohort_id', ignoreDuplicates: true });
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

  const { editId, title, config, coverImage, cohort_ids, deadline_days, status: bodyStatus, is_short_course } = body;
  const formStatus = bodyStatus === 'draft' ? 'draft' : 'published';
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!config)        return NextResponse.json({ error: 'Config is required' }, { status: 400 });

  const newCohortIds: string[] = Array.isArray(cohort_ids) ? cohort_ids : [];

  // Shared payload mapped to virtual_experiences columns
  const payload: any = {
    title:          title.trim(),
    description:    config.tagline || '',
    status:         formStatus,
    cohort_ids:     newCohortIds,
    cover_image:    coverImage || config.coverImage || null,
    deadline_days:  deadline_days ? Number(deadline_days) : (config.deadline_days ? Number(config.deadline_days) : null),
    theme:          config.theme         ?? null,
    mode:           config.mode          ?? null,
    font:           config.font          ?? null,
    custom_accent:  config.customAccent  ?? null,
    modules:        config.modules       ?? [],
    industry:       config.industry      ?? null,
    difficulty:     config.difficulty    ?? null,
    role:           config.role          ?? null,
    company:        config.company       ?? null,
    duration:       config.duration      ?? null,
    tools:          config.tools         ?? [],
    tool_logos:     config.toolLogos     ?? {},
    tagline:        config.tagline       ?? null,
    background:     config.background    ?? null,
    learn_outcomes: config.learnOutcomes ?? [],
    manager_name:   config.managerName   ?? null,
    manager_title:  config.managerTitle  ?? 'Manager',
    is_short_course: is_short_course ?? false,
    badge_image_url: config.badgeImageUrl ?? null,
    dataset:        null, // set below after optional storage upload
  };

  // Upload CSV to Supabase Storage if csvContent is present, then strip it from DB payload
  if (config.dataset) {
    const { csvContent, ...datasetMeta } = config.dataset as any;
    if (csvContent?.trim() && !datasetMeta.url && Buffer.byteLength(csvContent, 'utf-8') <= 50 * 1024 * 1024) {
      try {
        const safeName = (datasetMeta.filename || 'dataset.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${Date.now()}_${safeName}`;
        const buffer = Buffer.from(csvContent, 'utf-8');
        const { error: uploadError } = await supabase.storage
          .from('datasets')
          .upload(path, buffer, { contentType: 'text/csv', upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('datasets').getPublicUrl(path);
          datasetMeta.url = urlData.publicUrl;
        } else {
          console.error('[guided-project-save] dataset storage upload error:', uploadError.message);
        }
      } catch (e) {
        console.error('[guided-project-save] dataset storage upload exception:', e);
      }
    }
    payload.dataset = Object.keys(datasetMeta).length ? datasetMeta : null;
  }

  if (editId) {
    // Fetch current cohort_ids/status before updating so we can detect newly added cohorts and first publish
    const { data: existing } = await supabase
      .from('virtual_experiences')
      .select('cohort_ids, slug, status')
      .eq('id', editId)
      .eq('user_id', user.id)
      .single();

    const { error } = await supabase
      .from('virtual_experiences')
      .update(payload)
      .eq('id', editId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[guided-project-save] update error:', error);
      return NextResponse.json({ error: 'Failed to save project.' }, { status: 500 });
    }

    const oldCohortIds: string[] = Array.isArray(existing?.cohort_ids) ? existing.cohort_ids : [];
    const addedCohortIds   = newCohortIds.filter(id => !oldCohortIds.includes(id));
    const removedCohortIds = oldCohortIds.filter(id => !newCohortIds.includes(id));
    const isFirstPublish = existing?.status !== 'published' && formStatus === 'published';
    const notifyCohortIds = isFirstPublish ? newCohortIds : addedCohortIds;

    if (formStatus === 'published') {
      await upsertCohortAssignments(supabase, editId, newCohortIds);
    }

    if (formStatus === 'published') {
      if (removedCohortIds.length) {
        const { error: delErr } = await supabase
          .from('cohort_assignments')
          .delete()
          .eq('content_id', editId)
          .in('cohort_id', removedCohortIds);
        if (delErr) console.error('[guided-project-save] cohort_assignments delete error:', delErr);
      }
    } else {
      const { error: delErr } = await supabase
        .from('cohort_assignments')
        .delete()
        .eq('content_id', editId);
      if (delErr) console.error('[guided-project-save] draft cohort_assignments cleanup error:', delErr);
    }

    if (formStatus === 'published' && notifyCohortIds.length && existing?.slug) {
      try {
        await sendAssignmentNotifications({
          cohortIds:   notifyCohortIds,
          title:       title.trim(),
          slug:        existing.slug,
          contentType: 'virtual_experience',
        });
      } catch (err) {
        console.error('[guided-project-save] notification error (edit):', err);
        return NextResponse.json({ error: 'Saved but notification emails failed to send.' }, { status: 500 });
      }
    }

    if (formStatus === 'published') {
      fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
        body:    JSON.stringify({ formId: editId, contentType: 'virtual_experience' }),
      }).catch(() => {});
    }

    return NextResponse.json({ id: editId });
  }

  // Generate slug for new VE
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug  = `${base}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from('virtual_experiences')
    .insert({ ...payload, slug, user_id: user.id })
    .select('id, slug')
    .single();

  if (error) {
    console.error('[guided-project-save] insert error:', error);
    return NextResponse.json({ error: 'Failed to save project.' }, { status: 500 });
  }

  if (formStatus === 'published') {
    await upsertCohortAssignments(supabase, data.id, newCohortIds);
  }

  if (formStatus === 'published' && newCohortIds.length) {
    try {
      await sendAssignmentNotifications({
        cohortIds:   newCohortIds,
        title:       title.trim(),
        slug:        data.slug,
        contentType: 'virtual_experience',
      });
    } catch (err) {
      console.error('[guided-project-save] notification error (create):', err);
      return NextResponse.json({ error: 'Saved but notification emails failed to send.' }, { status: 500 });
    }
  }

  if (formStatus === 'published') {
    fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
      body:    JSON.stringify({ formId: data.id, contentType: 'virtual_experience' }),
    }).catch(() => {});
  }

  return NextResponse.json({ id: data.id, slug: data.slug });
}
