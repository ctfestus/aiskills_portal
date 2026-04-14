import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/admin-client';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';
import { getVectorIndex } from '@/lib/vector';
import { cloudinary, extractPublicId } from '@/lib/cloudinary-server';

async function deleteCloudinaryUrls(urls: (string | undefined | null)[]) {
  const ids = urls
    .filter((u): u is string => !!u && u.includes('res.cloudinary.com'))
    .map(u => extractPublicId(u))
    .filter((id): id is string => !!id);
  if (!ids.length) return;
  await Promise.all(
    ids.map(id => cloudinary.uploader.destroy(id).catch(e => console.error('[cloudinary] delete failed:', id, e?.message)))
  );
}

export const dynamic = 'force-dynamic';

function shortSlug() {
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

// Ensure every question has a unique id and a correctAnswer string.
// MCP sends `correct` as a 0-based index; CourseTaker expects `correctAnswer` as the option string.
function normalizeQuestions(questions: any[]): any[] {
  return (questions ?? []).map(q => {
    const normalized: any = {
      ...q,
      id: q.id || randomBytes(6).toString('base64url'),
    };
    if (!normalized.correctAnswer && typeof normalized.correct === 'number' && Array.isArray(normalized.options)) {
      normalized.correctAnswer = normalized.options[normalized.correct] ?? '';
    }
    return normalized;
  });
}

// Helper: find content by ID across all three tables.
// Returns { table, row } or null.
async function findContentById(supabase: ReturnType<typeof adminClient>, id: string) {
  const [c, e, v] = await Promise.all([
    supabase.from('courses').select('id, user_id, status, slug, cohort_ids').eq('id', id).maybeSingle(),
    supabase.from('events').select('id, user_id, status, slug, cohort_ids').eq('id', id).maybeSingle(),
    supabase.from('virtual_experiences').select('id, user_id, status, slug, cohort_ids').eq('id', id).maybeSingle(),
  ]);
  if (c.data) return { table: 'courses' as const, row: c.data };
  if (e.data) return { table: 'events' as const, row: e.data };
  if (v.data) return { table: 'virtual_experiences' as const, row: v.data };
  return null;
}

// Helper: upsert cohort_assignments using the new polymorphic columns.
async function upsertCohortAssignments(
  supabase: ReturnType<typeof adminClient>,
  contentType: string,
  contentId: string,
  cohortIds: string[],
) {
  if (!cohortIds.length) return;
  const rows = cohortIds.map(cohortId => ({ content_type: contentType, content_id: contentId, cohort_id: cohortId }));
  const { error } = await supabase
    .from('cohort_assignments')
    .upsert(rows, { onConflict: 'content_id,cohort_id', ignoreDuplicates: true });
  if (error) console.error('[cohort_assignments] upsert error:', error.message);
}

export async function POST(req: NextRequest) {
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

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!student || !['instructor', 'admin'].includes(student.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, config, slug: preferredSlug, cohort_ids, deadline_days, status: bodyStatus } = body;
  if (!config) return NextResponse.json({ error: 'config is required' }, { status: 400 });

  const formStatus = bodyStatus === 'draft' ? 'draft' : 'published';

  const isCourse = Boolean(config?.isCourse);
  const isEvent  = Boolean(config?.eventDetails?.isEvent);
  if (!isCourse && !isEvent) {
    return NextResponse.json({ error: 'config must set isCourse or eventDetails.isEvent' }, { status: 400 });
  }
  const content_type = isCourse ? 'course' : 'event';

  // Shared columns
  const shared = {
    user_id:       user.id,
    title:         title ?? 'Untitled',
    description:   description ?? null,
    status:        formStatus,
    cohort_ids:    cohort_ids ?? [],
    cover_image:   config.coverImage ?? null,
    deadline_days: deadline_days ? Number(deadline_days) : (config.deadline_days ? Number(config.deadline_days) : null),
    theme:         config.theme ?? null,
    mode:          config.mode ?? null,
    font:          config.font ?? null,
    custom_accent: config.customAccent ?? null,
  };

  let attempt = 0;
  let slug = preferredSlug?.trim() || shortSlug();

  while (attempt < 3) {
    if (attempt > 0) slug = shortSlug();

    let data: any, error: any;

    if (isCourse) {
      ({ data, error } = await supabase
        .from('courses')
        .insert({
          ...shared,
          slug,
          questions:      normalizeQuestions(config.questions),
          fields:         config.fields         ?? [],
          passmark:       config.passmark        ?? 50,
          course_timer:   config.courseTimer     ?? null,
          learn_outcomes: config.learnOutcomes   ?? [],
          points_enabled: config.pointsSystem?.enabled   ?? false,
          points_base:    config.pointsSystem?.basePoints ?? 100,
          post_submission: config.postSubmission ?? null,
        })
        .select('id, slug, status')
        .single());
    } else {
      ({ data, error } = await supabase
        .from('events')
        .insert({
          ...shared,
          slug,
          fields:       config.fields                      ?? [],
          event_date:   config.eventDetails?.date          || null,
          event_time:   config.eventDetails?.time          || null,
          timezone:     config.eventDetails?.timezone      || null,
          location:     config.eventDetails?.location      || null,
          event_type:   config.eventDetails?.eventType     ?? 'in-person',
          capacity:     config.eventDetails?.capacity      ?? null,
          meeting_link: config.eventDetails?.meetingLink   || null,
          is_private:   config.eventDetails?.isPrivate     ?? false,
          speakers:     config.eventDetails?.speakers      ?? [],
          post_submission: config.postSubmission           ?? null,
        })
        .select('id, slug, status')
        .single());
    }

    if (!error) {
      if (cohort_ids?.length) {
        await upsertCohortAssignments(supabase, content_type, data.id, cohort_ids);
        sendAssignmentNotifications({
          cohortIds:   cohort_ids,
          title:       title || '',
          slug:        data.slug,
          contentType: content_type,
        }).catch(() => {});
      }
      if (formStatus === 'published' && isCourse) {
        fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
          body:    JSON.stringify({ formId: data.id, contentType: content_type }),
        }).catch(e => console.error('[vector/index-course] fire-and-forget failed on create:', e?.message));
      }
      return NextResponse.json({ id: data.id, slug: data.slug, content_type, status: data.status });
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

export async function PUT(req: NextRequest) {
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

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, title, description, config, slug: preferredSlug, cohort_ids, status: bodyStatus } = body;
  if (!id || !config) return NextResponse.json({ error: 'id and config are required' }, { status: 400 });

  const found = await findContentById(supabase, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (found.row.user_id !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formStatus = bodyStatus === 'draft' ? 'draft' : (bodyStatus === 'published' ? 'published' : found.row.status);
  const slugValue = preferredSlug?.trim() || undefined;

  const shared: any = {
    title:         title ?? 'Untitled',
    description:   description ?? null,
    status:        formStatus,
    cohort_ids:    cohort_ids ?? found.row.cohort_ids ?? [],
    cover_image:   config.coverImage ?? null,
    deadline_days: config.deadline_days ? Number(config.deadline_days) : null,
    theme:         config.theme ?? null,
    mode:          config.mode ?? null,
    font:          config.font ?? null,
    custom_accent: config.customAccent ?? null,
    ...(slugValue ? { slug: slugValue } : {}),
  };

  let updatePayload: any;
  if (found.table === 'courses') {
    updatePayload = {
      ...shared,
      questions:      normalizeQuestions(config.questions),
      fields:         config.fields         ?? [],
      passmark:       config.passmark        ?? 50,
      course_timer:   config.timer           ?? config.courseTimer ?? null,
      learn_outcomes: config.learnOutcomes   ?? [],
      points_enabled: config.pointsEnabled   ?? config.pointsSystem?.enabled   ?? false,
      points_base:    config.pointsBase      ?? config.pointsSystem?.basePoints ?? 100,
      post_submission: config.postSubmission ?? null,
    };
  } else if (found.table === 'events') {
    updatePayload = {
      ...shared,
      fields:       config.fields                      ?? [],
      event_date:   config.eventDetails?.date          || null,
      event_time:   config.eventDetails?.time          || null,
      timezone:     config.eventDetails?.timezone      || null,
      location:     config.eventDetails?.location      || null,
      event_type:   config.eventDetails?.eventType     ?? 'in-person',
      capacity:     config.eventDetails?.capacity      ?? null,
      meeting_link: config.eventDetails?.meetingLink   || null,
      is_private:   config.eventDetails?.isPrivate     ?? false,
      speakers:     config.eventDetails?.speakers      ?? [],
      post_submission: config.postSubmission           ?? null,
    };
  } else {
    // virtual_experiences -- not edited via FormEditor but handle gracefully
    updatePayload = shared;
  }

  const { error: updateError } = await supabase.from(found.table).update(updatePayload).eq('id', id);
  if (updateError) {
    if (updateError.code === '23505') {
      return NextResponse.json({ error: 'slug already taken' }, { status: 409 });
    }
    console.error('[api/forms] update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update.' }, { status: 500 });
  }

  // Sync cohort_assignments for any newly added cohorts
  const prevCohorts = found.row.cohort_ids ?? [];
  const newCohorts  = cohort_ids ?? [];
  const addedCohorts = newCohorts.filter((c: string) => !prevCohorts.includes(c));
  if (addedCohorts.length) {
    const contentType = found.table === 'courses' ? 'course' : found.table === 'events' ? 'event' : 'virtual_experience';
    await upsertCohortAssignments(supabase, contentType, id, addedCohorts);
  }

  if (formStatus === 'published' && found.table === 'courses') {
    fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
      body:    JSON.stringify({ formId: id, contentType: 'course' }),
    }).catch(e => console.error('[vector/index-course] fire-and-forget failed on update:', e?.message));
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
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

  const found = await findContentById(supabase, formId);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (found.row.user_id !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase.from(found.table).update({ status }).eq('id', formId);
  if (updateError) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });

  if (status === 'published' && found.table === 'courses') {
    fetch(`${process.env.APP_URL || ''}/api/vector/index-course`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-reindex-secret': process.env.REINDEX_SECRET ?? '' },
      body:    JSON.stringify({ formId, contentType: 'course' }),
    }).catch(e => console.error('[vector/index-course] fire-and-forget failed on status change:', e?.message));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
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

  const found = await findContentById(supabase, formId);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  if (found.row.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Clean up Cloudinary images and Supabase Storage files before deleting
  if (found.table === 'courses') {
    const { data: row } = await supabase.from('courses').select('cover_image, questions').eq('id', formId).single();
    const urls = [
      row?.cover_image,
      ...(row?.questions ?? []).map((q: any) => q.imageUrl),
      ...(row?.questions ?? []).flatMap((q: any) => [q.lesson?.imageUrl]),
    ];
    await deleteCloudinaryUrls(urls);
  }

  if (found.table === 'events') {
    const { data: row } = await supabase.from('events').select('cover_image, speakers').eq('id', formId).single();
    const urls = [
      row?.cover_image,
      ...(row?.speakers ?? []).map((s: any) => s.avatar_url),
    ];
    await deleteCloudinaryUrls(urls);
  }

  if (found.table === 'virtual_experiences') {
    const { data: row } = await supabase.from('virtual_experiences').select('cover_image, dataset').eq('id', formId).single();
    await deleteCloudinaryUrls([row?.cover_image]);
    const datasetUrl = row?.dataset?.url;
    if (datasetUrl?.includes('/storage/v1/object/public/datasets/')) {
      const storagePath = datasetUrl.split('/storage/v1/object/public/datasets/')[1];
      if (storagePath) {
        await supabase.storage.from('datasets').remove([storagePath])
          .catch(e => console.error('[api/forms] dataset storage cleanup failed:', e));
      }
    }
  }

  // Delete from the correct table -- FKs cascade to course_attempts / guided_project_attempts
  const { error: deleteError } = await supabase.from(found.table).delete().eq('id', formId);
  if (deleteError) {
    console.error('[api/forms] delete error:', deleteError.message);
    return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  }

  // Also clean up event responses (no cascade from events table)
  if (found.table === 'events') {
    await supabase.from('responses').delete().eq('form_id', formId);
  }

  // Remove from vector index
  const index = getVectorIndex();
  if (index) index.delete([formId]).catch(e => console.error('[vector/delete] cleanup failed:', e?.message));

  return NextResponse.json({ ok: true });
}
