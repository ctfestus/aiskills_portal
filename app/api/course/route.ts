import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';
import { learningPathCertificateEmail } from '@/lib/email-templates';
import { getRedis, leaderboardKey, studentNameKey } from '@/lib/redis';
import { publishActivity } from '@/lib/activity';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const resend = new Resend(process.env.RESEND_API_KEY);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export const dynamic = 'force-dynamic';

async function getSessionUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user?.email) return null;
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  // -- Get all certificates for the logged-in student ---
  if (action === 'get-my-certificates') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const { data: certs } = await adminClient()
        .from('certificates')
        .select('id, course_id, ve_id, learning_path_id')
        .eq('student_id', sessionUser.id)
        .eq('revoked', false);
      return NextResponse.json({ certs: certs ?? [] });
    } catch (err: any) {
      console.error('[course/get-my-certificates]', err);
      return NextResponse.json({ error: 'Failed to load certificates.' }, { status: 500 });
    }
  }

  // -- Get current progress + cert + attempt count ---
  if (action === 'get-progress') {
    const { course_id } = body;
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const [{ data: cert }, { data: progress }, { count: attemptCount }] = await Promise.all([
        supabase.from('certificates').select('id')
          .eq('course_id', course_id).eq('student_id', sessionUser.id).eq('revoked', false)
          .maybeSingle(),
        supabase.from('course_attempts').select('*')
          .eq('course_id', course_id).eq('student_id', sessionUser.id)
          .is('completed_at', null)
          .order('started_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('course_attempts').select('id', { count: 'exact', head: true })
          .eq('course_id', course_id).eq('student_id', sessionUser.id)
          .not('completed_at', 'is', null),
      ]);
      return NextResponse.json({ cert, progress, attemptCount: attemptCount ?? 0 });
    } catch (err: any) {
      console.error('[course/get-progress]', err);
      return NextResponse.json({ error: 'Failed to load progress.' }, { status: 500 });
    }
  }

  // -- Save in-progress attempt (create if needed) ---
  if (action === 'save-progress') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { course_id, current_question_index, answers, score, points, streak, hints_used } = body;
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    try {
      const supabase = adminClient();

      const { data: course } = await supabase.from('courses').select('id').eq('id', course_id).single();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

      const payload = {
        current_question_index: current_question_index ?? 0,
        answers:                answers    ?? {},
        score:                  score      ?? 0,
        points:                 points     ?? 0,
        streak:                 streak     ?? 0,
        hints_used:             hints_used ?? [],
        updated_at:             new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('course_attempts').select('id')
        .eq('course_id', course_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('course_attempts').update(payload).eq('id', existing.id);
        if (error) { console.error('[course/save-progress] update', error); return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 }); }
      } else {
        const { data: last } = await supabase.from('course_attempts').select('attempt_number')
          .eq('course_id', course_id).eq('student_id', sessionUser.id)
          .order('attempt_number', { ascending: false }).limit(1).maybeSingle();

        const { error } = await supabase.from('course_attempts').insert({
          student_id:     sessionUser.id,
          course_id,
          attempt_number: (last?.attempt_number ?? 0) + 1,
          ...payload,
        });

        if (error) {
          // Unique constraint violation: another concurrent request already created the attempt.
          // Re-fetch it and update instead.
          if (error.code === '23505') {
            const { data: race } = await supabase.from('course_attempts').select('id')
              .eq('course_id', course_id).eq('student_id', sessionUser.id)
              .is('completed_at', null).limit(1).maybeSingle();
            if (race) {
              await supabase.from('course_attempts').update(payload).eq('id', race.id);
            }
          } else {
            console.error('[course/save-progress] insert', error);
            return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[course/save-progress]', err);
      return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 });
    }
  }

  // -- Mark active attempt as completed ---
  if (action === 'complete-attempt') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { course_id, score, passed, points, current_question_index } = body;
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const { data: attempt } = await supabase.from('course_attempts').select('id')
        .eq('course_id', course_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      if (attempt) {
        await supabase.from('course_attempts').update({
          completed_at:           new Date().toISOString(),
          passed:                 passed ?? false,
          score:                  score  ?? 0,
          points:                 points ?? 0,
          current_question_index: current_question_index ?? 0,
          updated_at:             new Date().toISOString(),
        }).eq('id', attempt.id);

        if (passed) {
          Promise.all([
            supabase.from('students').select('cohort_id, full_name').eq('id', sessionUser.id).single(),
            supabase.from('courses').select('title').eq('id', course_id).single(),
          ]).then(([{ data: stu }, { data: crs }]) => {
            if (!stu?.cohort_id || !crs?.title) return;
            const firstName = (stu.full_name || sessionUser.email).split(' ')[0];
            publishActivity(stu.cohort_id, {
              name:        firstName,
              action:      'completed',
              title:       crs.title,
              contentType: 'course',
              ts:          Date.now(),
            }).catch(() => {});
          }).catch(() => {});
        }

        if (points != null) {
          supabase
            .from('students')
            .select('cohort_id, full_name')
            .eq('id', sessionUser.id)
            .single()
            .then(({ data: student }) => {
              if (!student?.cohort_id) return;
              const lbKey   = leaderboardKey(student.cohort_id);
              const nameKey = studentNameKey(student.cohort_id);
              supabase
                .from('student_xp')
                .select('total_xp')
                .eq('student_id', sessionUser.id)
                .single()
                .then(({ data: xpRow }) => {
                  const totalXp = xpRow?.total_xp ?? 0;
                  const redis = getRedis();
                  if (!redis) return;
                  redis.pipeline()
                    .zadd(lbKey,   { score: totalXp, member: sessionUser.email })
                    .hset(nameKey, { [sessionUser.email]: student.full_name || sessionUser.email })
                    .expire(lbKey,   600)
                    .expire(nameKey, 600)
                    .exec()
                    .catch((err: any) => console.error('[course/complete-attempt] redis sync', err));
                });
            });
        }
      }
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[course/complete-attempt]', err);
      return NextResponse.json({ error: 'Failed to complete attempt.' }, { status: 500 });
    }
  }

  // -- Delete active in-progress attempt (fresh restart) ---
  if (action === 'clear-progress') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { course_id } = body;
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });
    try {
      const supabase = adminClient();
      await supabase.from('course_attempts').delete()
        .eq('course_id', course_id).eq('student_id', sessionUser.id).is('completed_at', null);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[course/clear-progress]', err);
      return NextResponse.json({ error: 'Failed to clear progress.' }, { status: 500 });
    }
  }

  // -- Issue certificate ---
  if (action === 'issue-certificate') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { course_id, student_name } = body;
    if (!course_id || !student_name)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    try {
      const supabase = adminClient();

      // Verify pass via course_attempts -- complete-attempt is now awaited before the
      // completion screen is shown, so this row is guaranteed to exist by this point.
      const { data: attempt } = await supabase.from('course_attempts')
        .select('id').eq('course_id', course_id).eq('student_id', sessionUser.id)
        .eq('passed', true).maybeSingle();
      if (!attempt) return NextResponse.json({ error: 'No passing attempt found' }, { status: 403 });

      const { data: existing } = await supabase.from('certificates').select('id')
        .eq('course_id', course_id).eq('student_id', sessionUser.id).eq('revoked', false).maybeSingle();
      if (existing?.id) return NextResponse.json({ certId: existing.id });

      const { data: cert, error } = await supabase.from('certificates').insert({
        course_id,
        student_name: student_name.trim(),
        student_id:   sessionUser.id,
      }).select('id').single();
      if (error) { console.error('[course/issue-certificate]', error); return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 }); }

      await updateLearningPathProgress(supabase, sessionUser.id, course_id);

      return NextResponse.json({ certId: cert.id });
    } catch (err: any) {
      console.error('[course/issue-certificate]', err);
      return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 });
    }
  }

  // -- Mark VE complete (called from guided project completion) ---
  if (action === 'mark-path-item-complete') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { item_id } = body;
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    try {
      const supabase = adminClient();
      await updateLearningPathProgress(supabase, sessionUser.id, item_id);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[course/mark-path-item-complete]', err);
      return NextResponse.json({ error: 'Failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// -- Shared helper: update learning_path_progress and auto-issue path cert ---
async function updateLearningPathProgress(supabase: any, studentId: string, completedItemId: string) {
  try {
    const { data: student } = await supabase.from('students').select('cohort_id').eq('id', studentId).single();
    if (!student?.cohort_id) return;

    const { data: paths } = await supabase
      .from('learning_paths')
      .select('id, item_ids, title, next_path_id')
      .eq('status', 'published')
      .contains('item_ids', [completedItemId])
      .contains('cohort_ids', [student.cohort_id]);

    if (!paths?.length) return;

    for (const path of paths) {
      const { data: prog } = await supabase
        .from('learning_path_progress')
        .select('*')
        .eq('student_id', studentId)
        .eq('learning_path_id', path.id)
        .maybeSingle();

      const existingCompleted: string[] = prog?.completed_item_ids ?? [];
      if (existingCompleted.includes(completedItemId)) continue;

      const updatedCompleted = [...existingCompleted, completedItemId];
      const allDone = (path.item_ids ?? []).every((id: string) => updatedCompleted.includes(id));

      const upsertData: any = {
        student_id: studentId,
        learning_path_id: path.id,
        completed_item_ids: updatedCompleted,
        updated_at: new Date().toISOString(),
      };
      if (allDone) upsertData.completed_at = new Date().toISOString();

      const { data: upserted } = await supabase
        .from('learning_path_progress')
        .upsert(upsertData, { onConflict: 'student_id,learning_path_id' })
        .select('id')
        .single();

      // Send "next up" email when a non-final item is completed
      if (!allDone) {
        const itemIds: string[] = path.item_ids ?? [];
        const completedIdx = itemIds.indexOf(completedItemId);
        const nextItemId = completedIdx >= 0 && completedIdx + 1 < itemIds.length ? itemIds[completedIdx + 1] : null;
        if (nextItemId) {
          try {
            const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
            if (studentRow?.email) {
              const [{ data: courses }, { data: ves }] = await Promise.all([
                supabase.from('courses').select('id, title, slug, cover_image, description').in('id', [completedItemId, nextItemId]),
                supabase.from('virtual_experiences').select('id, title, slug, cover_image, description').in('id', [completedItemId, nextItemId]),
              ]);
              const itemMap: Record<string, any> = {};
              for (const c of courses ?? []) itemMap[c.id] = { ...c, isVE: false };
              for (const v of ves   ?? []) itemMap[v.id] = { ...v, isVE: true };
              const completedItem = itemMap[completedItemId];
              const nextItem      = itemMap[nextItemId];
              if (completedItem && nextItem) {
                const { getTenantSettings } = await import('@/lib/get-tenant-settings');
                const { Resend } = await import('resend');
                const { courseCompletedNextUpEmail } = await import('@/lib/email-templates');
                const resend = new Resend(process.env.RESEND_API_KEY);
                const t = await getTenantSettings();
                const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
                const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
                const nextUrl = nextItem.isVE
                  ? `${t.appUrl}/student?section=virtual_experiences`
                  : `${t.appUrl}/${nextItem.slug || nextItemId}?go=1`;
                await resend.emails.send({
                  from: FROM,
                  to: studentRow.email,
                  subject: `You completed "${completedItem.title}" -- next up in ${path.title}`,
                  html: courseCompletedNextUpEmail({
                    name:             studentRow.full_name ?? 'there',
                    pathTitle:        path.title,
                    completedTitle:   completedItem.title,
                    completedNumber:  completedIdx + 1,
                    totalItems:       itemIds.length,
                    nextTitle:        nextItem.title,
                    nextUrl,
                    nextCoverImage:    nextItem.cover_image ?? null,
                    nextIsVE:         nextItem.isVE,
                    nextDescription:  nextItem.description ?? null,
                    branding,
                  }),
                });
              }
            }
          } catch (err) {
            console.error('[updateLearningPathProgress] next-up email failed', err);
          }
        }
      }

      // Auto-enroll student's cohort into next path when this path is completed
      if (allDone && path.next_path_id) {
        try {
          const { data: nextPath } = await supabase
            .from('learning_paths')
            .select('id, cohort_ids, title, description, item_ids')
            .eq('id', path.next_path_id)
            .single();
          if (nextPath) {
            const existingCohorts: string[] = nextPath.cohort_ids ?? [];
            if (!existingCohorts.includes(student.cohort_id)) {
              const updatedCohorts = [...existingCohorts, student.cohort_id];
              await supabase.from('learning_paths')
                .update({ cohort_ids: updatedCohorts })
                .eq('id', nextPath.id);
              // Notify the student about their new enrollment
              const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
              if (studentRow?.email) {
                try {
                  const { getTenantSettings } = await import('@/lib/get-tenant-settings');
                  const { Resend } = await import('resend');
                  const { learningPathAssignedEmail } = await import('@/lib/email-templates');
                  const resend = new Resend(process.env.RESEND_API_KEY);
                  const t = await getTenantSettings();
                  const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
                  const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
                  const itemIds: string[] = nextPath.item_ids ?? [];
                  const [{ data: courseItems }, { data: veItems }] = itemIds.length
                    ? await Promise.all([
                        supabase.from('courses').select('id, title, cover_image, description').in('id', itemIds),
                        supabase.from('virtual_experiences').select('id, title, cover_image, description').in('id', itemIds),
                      ])
                    : [{ data: [] }, { data: [] }];
                  const itemMap: Record<string, any> = {};
                  for (const c of courseItems ?? []) itemMap[c.id] = { ...c, isVE: false };
                  for (const v of veItems ?? []) itemMap[v.id] = { ...v, isVE: true };
                  const items = itemIds.map((id: string) => ({
                    title: itemMap[id]?.title ?? 'Untitled',
                    coverImage:   itemMap[id]?.cover_image ?? null,
                    isVE:         itemMap[id]?.isVE ?? false,
                    description:  itemMap[id]?.description ?? undefined,
                  }));
                  await resend.emails.send({
                    from: FROM,
                    to: studentRow.email,
                    subject: `You've been enrolled in a new learning path: ${nextPath.title}`,
                    html: learningPathAssignedEmail({
                      name: studentRow.full_name ?? 'there',
                      pathTitle: nextPath.title,
                      pathDescription: nextPath.description ?? undefined,
                      dashboardUrl: `${t.appUrl}/student?section=courses`,
                      items,
                      branding,
                    }),
                  });
                } catch (emailErr) {
                  console.error('[updateLearningPathProgress] next-path email failed', emailErr);
                }
              }
            }
          }
        } catch (nextErr) {
          console.error('[updateLearningPathProgress] next-path auto-enroll failed', nextErr);
        }
      }

      if (allDone && !prog?.cert_id) {
        const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
        const studentName = studentRow?.full_name ?? 'Student';

        const { data: pathCert } = await supabase.from('certificates').insert({
          course_id: null,
          learning_path_id: path.id,
          student_name: studentName,
          student_id: studentId,
        }).select('id').single();

        if (pathCert?.id && upserted?.id) {
          await supabase.from('learning_path_progress')
            .update({ cert_id: pathCert.id })
            .eq('id', upserted.id);

          if (studentRow?.email) {
            try {
              const { data: fullPath } = await supabase
                .from('learning_paths')
                .select('title, description, item_ids')
                .eq('id', path.id)
                .single();

              const itemIds: string[] = fullPath?.item_ids ?? [];

              // Fetch items from both courses and virtual_experiences tables
              const [{ data: courseItems }, { data: veItems }] = await Promise.all([
                itemIds.length
                  ? supabase.from('courses').select('id, title, cover_image, description').in('id', itemIds)
                  : { data: [] },
                itemIds.length
                  ? supabase.from('virtual_experiences').select('id, title, cover_image, description').in('id', itemIds)
                  : { data: [] },
              ]);

              const itemMap: Record<string, any> = {};
              for (const c of courseItems ?? []) itemMap[c.id] = { ...c, isVE: false };
              for (const v of veItems   ?? []) itemMap[v.id] = { ...v, isVE: true };

              const items = itemIds.map((id: string) => {
                const item = itemMap[id];
                return {
                  title:      item?.title      ?? 'Untitled',
                  coverImage:  item?.cover_image  ?? null,
                  isVE:        item?.isVE         ?? false,
                  description: item?.description  ?? null,
                };
              });

              const t        = await getTenantSettings();
              const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
              const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
              const certUrl  = `${t.appUrl}/certificate/${pathCert.id}`;
              await resend.emails.send({
                from: FROM,
                to: studentRow.email,
                subject: `Your Learning Path Certificate is ready: ${fullPath?.title ?? path.title}`,
                html: learningPathCertificateEmail({
                  name: studentName,
                  pathTitle: fullPath?.title ?? path.title,
                  certUrl,
                  items,
                  branding,
                }),
              });
            } catch (emailErr) {
              console.error('[updateLearningPathProgress] cert email failed', emailErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[updateLearningPathProgress]', err);
  }
}
