import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export const dynamic = 'force-dynamic';

async function getSessionEmail(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  return user?.email?.trim().toLowerCase() ?? null;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  // -- Get all certificates for the logged-in student ---
  if (action === 'get-my-certificates') {
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const { data: certs } = await adminClient()
        .from('certificates')
        .select('id, form_id')
        .eq('student_email', sessionEmail)
        .eq('revoked', false);
      return NextResponse.json({ certs: certs ?? [] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // -- Get current progress + cert + attempt count ---
  if (action === 'get-progress') {
    const { form_id } = body;
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const [{ data: cert }, { data: progress }, { count: attemptCount }] = await Promise.all([
        supabase.from('certificates').select('id')
          .eq('form_id', form_id).eq('student_email', sessionEmail).eq('revoked', false)
          .maybeSingle(),
        // Active (in-progress) attempt only
        supabase.from('course_attempts').select('*')
          .eq('form_id', form_id).eq('student_email', sessionEmail)
          .is('completed_at', null)
          .order('started_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('course_attempts').select('id', { count: 'exact', head: true })
          .eq('form_id', form_id).eq('student_email', sessionEmail)
          .not('completed_at', 'is', null),
      ]);
      return NextResponse.json({ cert, progress, attemptCount: attemptCount ?? 0 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // -- Save in-progress attempt (create if needed) ---
  if (action === 'save-progress') {
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { form_id, student_name, current_question_index, answers, score, points, streak, hints_used } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();

      // Verify the form exists and is a course
      const { data: form } = await supabase.from('forms').select('id, config').eq('id', form_id).single();
      if (!form?.config?.isCourse) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

      const payload = {
        student_name:           student_name ?? null,
        current_question_index: current_question_index ?? 0,
        answers:                answers    ?? {},
        score:                  score      ?? 0,
        points:                 points     ?? 0,
        streak:                 streak     ?? 0,
        hints_used:             hints_used ?? [],
        updated_at:             new Date().toISOString(),
      };

      // Find existing in-progress attempt
      const { data: existing } = await supabase.from('course_attempts').select('id')
        .eq('form_id', form_id).eq('student_email', sessionEmail)
        .is('completed_at', null)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('course_attempts').update(payload).eq('id', existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        // Get next attempt number
        const { data: last } = await supabase.from('course_attempts').select('attempt_number')
          .eq('form_id', form_id).eq('student_email', sessionEmail)
          .order('attempt_number', { ascending: false }).limit(1).maybeSingle();

        const { error } = await supabase.from('course_attempts').insert({
          student_email:  sessionEmail,
          form_id,
          attempt_number: (last?.attempt_number ?? 0) + 1,
          ...payload,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // -- Mark active attempt as completed ---
  if (action === 'complete-attempt') {
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { form_id, score, passed, points, current_question_index } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });

    try {
      const supabase = adminClient();
      const { data: attempt } = await supabase.from('course_attempts').select('id')
        .eq('form_id', form_id).eq('student_email', sessionEmail)
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
      }
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // -- Delete active in-progress attempt (fresh restart) ---
  if (action === 'clear-progress') {
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { form_id } = body;
    if (!form_id) return NextResponse.json({ error: 'form_id required' }, { status: 400 });
    try {
      const supabase = adminClient();
      await supabase.from('course_attempts').delete()
        .eq('form_id', form_id).eq('student_email', sessionEmail).is('completed_at', null);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // -- Issue certificate ---
  if (action === 'issue-certificate') {
    const sessionEmail = await getSessionEmail(req);
    if (!sessionEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      if (submittedEmail && submittedEmail !== sessionEmail) return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });

      const { data: existing } = await supabase.from('certificates').select('id')
        .eq('form_id', form_id).eq('student_email', sessionEmail).eq('revoked', false).maybeSingle();
      if (existing?.id) return NextResponse.json({ certId: existing.id });

      const { data: cert, error } = await supabase.from('certificates').insert({
        form_id, response_id,
        student_name:  response.data.name,
        student_email: sessionEmail,
      }).select('id').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ certId: cert.id });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
