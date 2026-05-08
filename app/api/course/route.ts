import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';
import { getRedis, leaderboardKey, studentNameKey } from '@/lib/redis';
import { publishActivity } from '@/lib/activity';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import { updateLearningPathProgress } from '@/lib/learning-path-progress';
import { courseResultEmail } from '@/lib/email-templates';

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
      const [{ data: cert }, { data: progress }, { count: attemptCount }, { data: passingAttempt }] = await Promise.all([
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
        // Best passing attempt -- used to restore answers/progress in review mode
        supabase.from('course_attempts')
          .select('answers, current_question_index, score, points, hints_used, streak')
          .eq('course_id', course_id).eq('student_id', sessionUser.id)
          .eq('passed', true).not('completed_at', 'is', null)
          .order('score', { ascending: false }).limit(1).maybeSingle(),
      ]);
      return NextResponse.json({ cert, progress, attemptCount: attemptCount ?? 0, hasPassed: !!passingAttempt, passingAttempt });
    } catch (err: any) {
      console.error('[course/get-progress]', err);
      return NextResponse.json({ error: 'Failed to load progress.' }, { status: 500 });
    }
  }

  // -- Save in-progress attempt (create if needed) ---
  if (action === 'save-progress') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { course_id, current_question_index, answers, streak, hints_used, points } = body;
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    try {
      const supabase = adminClient();

      const { data: course } = await supabase.from('courses').select('id').eq('id', course_id).single();
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

      const payload = {
        current_question_index: current_question_index ?? 0,
        answers:                answers    ?? {},
        streak:                 streak     ?? 0,
        hints_used:             hints_used ?? [],
        points:                 points     ?? 0,
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
    const { course_id, current_question_index, final_answers } = body;
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 });

    try {
      const supabase = adminClient();

      const [{ data: courseData }, { data: attempt }] = await Promise.all([
        supabase.from('courses')
          .select('questions, passmark, points_enabled, points_base')
          .eq('id', course_id).single(),
        supabase.from('course_attempts')
          .select('id, answers, hints_used')
          .eq('course_id', course_id).eq('student_id', sessionUser.id)
          .is('completed_at', null)
          .order('started_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (attempt && courseData) {
        // Server-side scoring - client-supplied score/passed/points are ignored.
        // Merge final_answers (sent by client) over stored answers so that the last
        // lessonOnly 'viewed' entry is always present, regardless of race timing.
        const questions: any[]              = Array.isArray(courseData.questions) ? courseData.questions : [];
        const storedAnswers: Record<string, string> = {
          ...(attempt.answers ?? {}),
          ...(final_answers && typeof final_answers === 'object' ? final_answers : {}),
        };
        const hintsUsed: string[]           = attempt.hints_used ?? [];
        const passmark                      = courseData.passmark ?? 50;

        const scorable = questions.filter(q => !q.lessonOnly && !q.isSection);
        let correct = 0;
        for (const q of scorable) {
          const ua = storedAnswers[q.id];
          if (ua == null) continue;
          const type = q.type ?? 'multiple_choice';
          if (['code_review', 'excel_review', 'dashboard_critique'].includes(type)) {
            if (ua === 'completed') correct++;
          } else if (type === 'fill_blank') {
            const accepted = (q.correctAnswer ?? '').split('|').map((s: string) => s.trim().toLowerCase());
            if (accepted.includes(ua.trim().toLowerCase())) correct++;
          } else if (type === 'arrange') {
            if (ua === q.correctAnswer) correct++;
          } else {
            if (ua === q.correctAnswer) correct++;
          }
        }

        const total     = scorable.length;
        const scorePct  = total === 0 ? 100 : Math.round((correct / total) * 100);
        const passed    = scorePct >= passmark;
        const computed_points = courseData.points_enabled
          ? Math.max(0, correct * (courseData.points_base ?? 100) - hintsUsed.length * 20)
          : 0;

        await supabase.from('course_attempts').update({
          completed_at:           new Date().toISOString(),
          passed,
          score:                  scorePct,
          points:                 computed_points,
          current_question_index: current_question_index ?? 0,
          answers:                storedAnswers,
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

        supabase
          .from('students').select('cohort_id, full_name')
          .eq('id', sessionUser.id).single()
          .then(({ data: student }) => {
            if (!student?.cohort_id) return;
            const lbKey   = leaderboardKey(student.cohort_id);
            const nameKey = studentNameKey(student.cohort_id);
            supabase.from('student_xp').select('total_xp')
              .eq('student_id', sessionUser.id).single()
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

      // Award badge + send cert email (fire-and-forget)
      (async () => {
        try {
          const [{ data: courseRow }, { data: studentRow }, { data: bestAttempt }] = await Promise.all([
            supabase.from('courses').select('title, slug, badge_image_url').eq('id', course_id).single(),
            supabase.from('students').select('full_name, email').eq('id', sessionUser.id).single(),
            supabase.from('course_attempts').select('score, points')
              .eq('course_id', course_id).eq('student_id', sessionUser.id)
              .eq('passed', true).order('score', { ascending: false }).limit(1).maybeSingle(),
          ]);
          if (!courseRow || !studentRow?.email) return;

          let badgeName: string | undefined;
          let badgeImageUrl: string | undefined;
          if (courseRow.badge_image_url) {
            try {
              const badgeId = `crs_${course_id}`;
              await supabase.from('badges').upsert({
                id:          badgeId,
                name:        `${courseRow.title} Badge`,
                description: `Awarded for completing ${courseRow.title}`,
                icon:        'graduated',
                color:       '#6366f1',
                image_url:   courseRow.badge_image_url,
                category:    'course',
              }, { onConflict: 'id' });
              await supabase.from('student_badges').upsert({
                student_id: sessionUser.id,
                badge_id:   badgeId,
              }, { onConflict: 'student_id,badge_id', ignoreDuplicates: true });
              badgeName     = `${courseRow.title} Badge`;
              badgeImageUrl = courseRow.badge_image_url;
            } catch (badgeErr) {
              console.error('[course/issue-certificate] badge award failed', badgeErr);
            }
          }

          if (process.env.RESEND_API_KEY) {
            const t        = await getTenantSettings();
            const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
            const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
            const certUrl  = `${t.appUrl}/certificate/${cert.id}`;
            const formUrl  = courseRow.slug ? `${t.appUrl}/${courseRow.slug}` : `${t.appUrl}/${course_id}`;
            const resend   = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from:    FROM,
              to:      studentRow.email,
              subject: `Congratulations! Your certificate for ${courseRow.title} is ready`,
              html:    courseResultEmail({
                name:         studentRow.full_name ?? 'there',
                courseTitle:  courseRow.title,
                score:        bestAttempt?.score ?? 100,
                total:        100,
                percentage:   bestAttempt?.score ?? 100,
                passed:       true,
                points:       bestAttempt?.points ?? undefined,
                formUrl,
                certUrl,
                badgeName,
                badgeImageUrl,
                branding,
              }),
            });
          }
        } catch (err) {
          console.error('[course/issue-certificate] post-cert tasks failed', err);
        }
      })();

      return NextResponse.json({ certId: cert.id });
    } catch (err: any) {
      console.error('[course/issue-certificate]', err);
      return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
