import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { learningPathAssignedEmail } from '@/lib/email-templates';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getSessionUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user?.email) return null;
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

export const dynamic = 'force-dynamic';

// GET -- instructor fetches their own learning paths
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: paths, error } = await adminClient()
    .from('learning_paths')
    .select('*')
    .eq('instructor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('[learning-paths] GET error:', error); return NextResponse.json({ error: 'Failed to fetch learning paths.' }, { status: 500 }); }
  return NextResponse.json({ paths: paths ?? [] });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;
  const supabase = adminClient();

  // -- Create ---
  if (action === 'create') {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, cover_image, item_ids, cohort_ids, status } = body;
    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const { data, error } = await supabase.from('learning_paths').insert({
      title: title.trim(),
      description: description ?? null,
      cover_image: cover_image ?? null,
      instructor_id: user.id,
      item_ids: item_ids ?? [],
      cohort_ids: cohort_ids ?? [],
      status: status ?? 'draft',
    }).select('id').single();

    if (error) { console.error('[learning-paths] create error:', error); return NextResponse.json({ error: 'Failed to create learning path.' }, { status: 500 }); }

    // Send assignment emails if published with cohorts
    if ((status ?? 'draft') === 'published' && (cohort_ids ?? []).length > 0) {
      await sendPathAssignmentEmails(supabase, data.id, title.trim(), description, item_ids ?? [], cohort_ids);
    }

    return NextResponse.json({ id: data.id });
  }

  // -- Update ---
  if (action === 'update') {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, title, description, cover_image, item_ids, cohort_ids, status } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Fetch previous state to detect newly published or newly added cohorts
    const { data: prev } = await supabase.from('learning_paths').select('status, cohort_ids').eq('id', id).single();

    const { error } = await supabase.from('learning_paths')
      .update({
        title: title?.trim(),
        description: description ?? null,
        cover_image: cover_image ?? null,
        item_ids: item_ids ?? [],
        cohort_ids: cohort_ids ?? [],
        status: status ?? 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('instructor_id', user.id);

    if (error) { console.error('[learning-paths] update error:', error); return NextResponse.json({ error: 'Failed to update learning path.' }, { status: 500 }); }

    // Send assignment emails to cohorts that are newly added (or path just published)
    if ((status ?? 'draft') === 'published' && (cohort_ids ?? []).length > 0) {
      const prevCohorts: string[] = prev?.cohort_ids ?? [];
      const wasPublished = prev?.status === 'published';
      const newCohorts = wasPublished
        ? (cohort_ids ?? []).filter((cid: string) => !prevCohorts.includes(cid))
        : cohort_ids ?? []; // just published -- notify all cohorts
      if (newCohorts.length > 0) {
        await sendPathAssignmentEmails(supabase, id, title?.trim(), description, item_ids ?? [], newCohorts);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // -- Delete ---
  if (action === 'delete') {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabase.from('learning_paths')
      .delete()
      .eq('id', id)
      .eq('instructor_id', user.id);

    if (error) { console.error('[learning-paths] delete error:', error); return NextResponse.json({ error: 'Failed to delete learning path.' }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  // -- Student: get enrolled paths with progress ---
  if (action === 'get-student-paths') {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get student's cohort
    const { data: student } = await supabase
      .from('students')
      .select('cohort_id')
      .eq('id', user.id)
      .single();

    if (!student?.cohort_id) return NextResponse.json({ paths: [] });

    // Fetch published paths that include student's cohort
    const { data: paths } = await supabase
      .from('learning_paths')
      .select('*')
      .eq('status', 'published')
      .contains('cohort_ids', [student.cohort_id]);

    if (!paths?.length) return NextResponse.json({ paths: [] });

    // Fetch student's progress for those paths
    const pathIds = paths.map((p: any) => p.id);
    const { data: progRows } = await supabase
      .from('learning_path_progress')
      .select('*')
      .eq('student_id', user.id)
      .in('learning_path_id', pathIds);

    const progressMap: Record<string, any> = {};
    for (const p of progRows ?? []) progressMap[p.learning_path_id] = p;

    // Fetch content metadata for all item_ids across all paths
    const allItemIds = [...new Set(paths.flatMap((p: any) => p.item_ids ?? []))];
    const [{ data: coursesRaw }, { data: vesRaw }] = allItemIds.length
      ? await Promise.all([
          supabase.from('courses').select('id, title, slug, cover_image').in('id', allItemIds),
          supabase.from('virtual_experiences').select('id, title, slug, cover_image').in('id', allItemIds),
        ])
      : [{ data: [] }, { data: [] }];

    const formMap: Record<string, any> = {};
    for (const c of coursesRaw ?? []) formMap[c.id] = { ...c, content_type: 'course' };
    for (const v of vesRaw     ?? []) formMap[v.id] = { ...v, content_type: 'virtual_experience' };

    // Determine which items the student has actually completed by checking
    // course_attempts and guided_project_attempts directly -- this covers
    // courses completed before the learning path feature was deployed.
    const [{ data: courseAttempts }, { data: veAttempts }] = await Promise.all([
      allItemIds.length
        ? supabase.from('course_attempts').select('course_id').eq('student_id', user.id).not('completed_at', 'is', null).in('course_id', allItemIds)
        : { data: [] },
      allItemIds.length
        ? supabase.from('guided_project_attempts').select('ve_id').eq('student_id', user.id).not('completed_at', 'is', null).in('ve_id', allItemIds)
        : { data: [] },
    ]);

    const actuallyCompleted = new Set([
      ...(courseAttempts ?? []).map((a: any) => a.course_id),
      ...(veAttempts ?? []).map((a: any) => a.ve_id),
    ]);

    const result = paths.map((path: any) => {
      const prog = progressMap[path.id] ?? null;
      // Merge: stored completed_item_ids + any items actually completed in attempts
      const storedIds: string[] = prog?.completed_item_ids ?? [];
      const effectiveCompleted = [...new Set([
        ...storedIds,
        ...(path.item_ids ?? []).filter((id: string) => actuallyCompleted.has(id)),
      ])];
      return {
        ...path,
        progress: prog
          ? { ...prog, completed_item_ids: effectiveCompleted }
          : effectiveCompleted.length ? { completed_item_ids: effectiveCompleted, completed_at: null, cert_id: null } : null,
        items: (path.item_ids ?? []).map((id: string) => formMap[id] ?? { id, title: 'Unknown' }),
      };
    });

    return NextResponse.json({ paths: result });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// -- Send assignment emails to all students in given cohorts ---
async function sendPathAssignmentEmails(
  supabase: any,
  pathId: string,
  pathTitle: string,
  pathDescription: string | null,
  itemIds: string[],
  cohortIds: string[],
) {
  try {
    // Fetch content metadata for email from courses and virtual_experiences
    const [{ data: coursesRaw }, { data: vesRaw }] = itemIds.length
      ? await Promise.all([
          supabase.from('courses').select('id, title, cover_image').in('id', itemIds),
          supabase.from('virtual_experiences').select('id, title, cover_image').in('id', itemIds),
        ])
      : [{ data: [] }, { data: [] }];

    const contentMap: Record<string, any> = {};
    for (const c of coursesRaw ?? []) contentMap[c.id] = { ...c, content_type: 'course' };
    for (const v of vesRaw     ?? []) contentMap[v.id] = { ...v, content_type: 'virtual_experience' };

    const items = itemIds.map((id: string) => {
      const f = contentMap[id];
      const isVE = f?.content_type === 'virtual_experience';
      return {
        title:      f?.title ?? 'Untitled',
        coverImage: f?.cover_image ?? null,
        isVE,
        description: undefined,
      };
    });

    // Fetch all students in those cohorts
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, email')
      .in('cohort_id', cohortIds)
      .eq('role', 'student');

    if (!students?.length) return;

    const dashboardUrl = `${APP_URL}/student?section=courses`;

    for (const student of students) {
      if (!student.email) continue;
      try {
        await resend.emails.send({
          from: FROM,
          to: student.email,
          subject: `You've been enrolled in a new learning path: ${pathTitle}`,
          html: learningPathAssignedEmail({
            name: student.full_name ?? 'there',
            pathTitle,
            pathDescription: pathDescription ?? undefined,
            dashboardUrl,
            items,
          }),
        });
      } catch (e) {
        console.error('[sendPathAssignmentEmails] failed for', student.email, e);
      }
    }
  } catch (err) {
    console.error('[sendPathAssignmentEmails]', err);
  }
}
