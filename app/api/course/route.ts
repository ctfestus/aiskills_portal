import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';
import { getRedis, leaderboardKey, studentNameKey } from '@/lib/redis';
import { publishActivity } from '@/lib/activity';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://festforms.com';

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
        .select('id, form_id')
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
    const { form_id } = body;
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const [{ data: cert }, { data: progress }, { count: attemptCount }] = await Promise.all([
        supabase.from('certificates').select('id')
          .eq('form_id', form_id).eq('student_id', sessionUser.id).eq('revoked', false)
          .maybeSingle(),
        supabase.from('course_attempts').select('*')
          .eq('form_id', form_id).eq('student_id', sessionUser.id)
          .is('completed_at', null)
          .order('started_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('course_attempts').select('id', { count: 'exact', head: true })
          .eq('form_id', form_id).eq('student_id', sessionUser.id)
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
    const { form_id, current_question_index, answers, score, points, streak, hints_used } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();

      const { data: form } = await supabase.from('forms').select('id, config').eq('id', form_id).single();
      if (!form?.config?.isCourse) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

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
        .eq('form_id', form_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('course_attempts').update(payload).eq('id', existing.id);
        if (error) { console.error('[course/save-progress] update', error); return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 }); }
      } else {
        const { data: last } = await supabase.from('course_attempts').select('attempt_number')
          .eq('form_id', form_id).eq('student_id', sessionUser.id)
          .order('attempt_number', { ascending: false }).limit(1).maybeSingle();

        const { error } = await supabase.from('course_attempts').insert({
          student_id:     sessionUser.id,
          form_id,
          attempt_number: (last?.attempt_number ?? 0) + 1,
          ...payload,
        });
        if (error) { console.error('[course/save-progress] insert', error); return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 }); }
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
    const { form_id, score, passed, points, current_question_index } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const { data: attempt } = await supabase.from('course_attempts').select('id')
        .eq('form_id', form_id).eq('student_id', sessionUser.id)
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

        // Publish cohort activity feed event (fire-and-forget)
        if (passed) {
          Promise.all([
            supabase.from('students').select('cohort_id, full_name').eq('id', sessionUser.id).single(),
            supabase.from('forms').select('title').eq('id', form_id).single(),
          ]).then(([{ data: stu }, { data: frm }]) => {
            if (!stu?.cohort_id || !frm?.title) return;
            const firstName = (stu.full_name || sessionUser.email).split(' ')[0];
            publishActivity(stu.cohort_id, {
              name:        firstName,
              action:      'completed',
              title:       frm.title,
              contentType: 'course',
              ts:          Date.now(),
            }).catch(() => {});
          }).catch(() => {});
        }

        // Sync XP to Redis leaderboard sorted set (fire-and-forget)
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
              // Read current XP from student_xp (the trigger has already updated it)
              supabase
                .from('student_xp')
                .select('total_xp')
                .eq('student_id', sessionUser.id)
                .single()
                .then(({ data: xpRow }) => {
                  const totalXp = xpRow?.total_xp ?? 0;
                  const redis = getRedis();
                  if (!redis) return;
                  // Redis still keyed by email for display purposes
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
    const { form_id } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });
    try {
      const supabase = adminClient();
      await supabase.from('course_attempts').delete()
        .eq('form_id', form_id).eq('student_id', sessionUser.id).is('completed_at', null);
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
    const { form_id, response_id, student_name } = body;
    if (!form_id || !response_id || !student_name)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    try {
      const supabase = adminClient();
      const { data: response, error: respErr } = await supabase.from('responses')
        .select('id, form_id, data').eq('id', response_id).eq('form_id', form_id).single();
      if (respErr || !response) return NextResponse.json({ error: 'Response not found' }, { status: 404 });
      if (response.data?.passed !== true) return NextResponse.json({ error: 'Student has not passed' }, { status: 403 });

      const submittedName  = (response.data?.name  ?? '').trim().toLowerCase();
      const submittedEmail = (response.data?.email ?? '').trim().toLowerCase();
      const claimedName    = student_name.trim().toLowerCase();
      if (submittedName !== claimedName) return NextResponse.json({ error: 'Name mismatch' }, { status: 403 });
      if (submittedEmail && submittedEmail !== sessionUser.email) return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });

      const { data: existing } = await supabase.from('certificates').select('id')
        .eq('form_id', form_id).eq('student_id', sessionUser.id).eq('revoked', false).maybeSingle();
      if (existing?.id) return NextResponse.json({ certId: existing.id });

      const { data: cert, error } = await supabase.from('certificates').insert({
        form_id,
        response_id,
        student_name:  response.data.name,
        student_id:    sessionUser.id,
      }).select('id').single();
      if (error) { console.error('[course/issue-certificate]', error); return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 }); }
      return NextResponse.json({ certId: cert.id });
    } catch (err: any) {
      console.error('[course/issue-certificate]', err);
      return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
