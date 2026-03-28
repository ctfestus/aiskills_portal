import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { milestoneEmail } from '@/lib/email-templates';
import { hasNudgeBeenSent, recordNudge, totalRequirements, completedRequirements } from '@/lib/nudge-helpers';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <notifications@festforms.com>';
const APP_URL = process.env.APP_URL || 'https://festforms.com';

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

// -- GET /api/guided-project-progress?formId=&email= ---
// Returns the attempt row for a student (used by the taker to restore state)
// Also used by dashboard (creator): ?formId= without email returns all attempts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  const email  = searchParams.get('email');

  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const supabase = adminClient();

  // Creator/admin view -- return all attempts for a form
  if (!email) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership
    const { data: form } = await supabase.from('forms').select('user_id').eq('id', formId).single();
    const isAdmin = user.email?.endsWith('@aiskillsafrica.com');
    if (!form || (form.user_id !== user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: attempts } = await supabase
      .from('guided_project_attempts')
      .select('*')
      .eq('form_id', formId)
      .order('started_at', { ascending: false });

    return NextResponse.json({ attempts: attempts ?? [] });
  }

  // Student view -- return their own attempt
  const { data: attempt } = await supabase
    .from('guided_project_attempts')
    .select('*')
    .eq('form_id', formId)
    .eq('student_email', email.toLowerCase().trim())
    .maybeSingle();

  return NextResponse.json({ attempt: attempt ?? null });
}

// -- POST /api/guided-project-progress ---
// Upserts a student's progress, or saves an instructor review
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = adminClient();

  // -- Instructor review --
  if (body.action === 'review') {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { attemptId, score, feedback } = body;
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 });

    // Verify the attempt's form belongs to this creator
    const { data: attempt } = await supabase
      .from('guided_project_attempts')
      .select('form_id')
      .eq('id', attemptId)
      .single();

    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    const { data: form } = await supabase
      .from('forms')
      .select('user_id')
      .eq('id', attempt.form_id)
      .single();

    const isAdmin = user.email?.endsWith('@aiskillsafrica.com');
    if (!form || (form.user_id !== user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('guided_project_attempts')
      .update({
        review: {
          score:       Number(score) || 0,
          feedback:    String(feedback || '').slice(0, 2000),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        },
      })
      .eq('id', attemptId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // -- Issue certificate --
  if (body.action === 'issue-certificate') {
    const { formId, studentEmail, studentName } = body;
    if (!formId || !studentEmail) return NextResponse.json({ error: 'formId and studentEmail required' }, { status: 400 });

    const email = String(studentEmail).toLowerCase().trim();

    // Verify the attempt is completed
    const { data: attempt } = await supabase
      .from('guided_project_attempts')
      .select('id, completed_at')
      .eq('form_id', formId)
      .eq('student_email', email)
      .not('completed_at', 'is', null)
      .maybeSingle();

    if (!attempt) return NextResponse.json({ error: 'Project not completed' }, { status: 403 });

    // Return existing certificate if already issued
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('form_id', formId)
      .eq('student_email', email)
      .eq('revoked', false)
      .maybeSingle();

    if (existing?.id) return NextResponse.json({ certId: existing.id });

    // Issue new certificate
    const { data: cert, error: certErr } = await supabase
      .from('certificates')
      .insert({ form_id: formId, student_name: studentName || email, student_email: email })
      .select('id')
      .single();

    if (certErr) return NextResponse.json({ error: certErr.message }, { status: 500 });
    return NextResponse.json({ certId: cert.id });
  }

  // -- Student progress save --
  const { formId, studentEmail, studentName, progress, currentModuleId, currentLessonId, completedAt } = body;

  if (!formId || !studentEmail) {
    return NextResponse.json({ error: 'formId and studentEmail required' }, { status: 400 });
  }

  const email = String(studentEmail).toLowerCase().trim();

  const { error } = await supabase
    .from('guided_project_attempts')
    .upsert(
      {
        form_id:           formId,
        student_email:     email,
        student_name:      studentName || null,
        progress:          progress || {},
        current_module_id: currentModuleId || null,
        current_lesson_id: currentLessonId || null,
        completed_at:      completedAt || null,
      },
      { onConflict: 'student_email,form_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // -- 80% milestone check (fire-and-forget) --
  if (progress && !completedAt && process.env.RESEND_API_KEY) {
    (async () => {
      try {
        const { data: form } = await supabase
          .from('forms')
          .select('config, title, slug, content_type')
          .eq('id', formId)
          .single();

        if (!form) return;
        const total = totalRequirements(form.config);
        if (total === 0) return;

        const done = completedRequirements(progress);
        const pct  = Math.round((done / total) * 100);
        if (pct < 80) return;

        const alreadySent = await hasNudgeBeenSent(supabase, email, formId, 'milestone_80');
        if (alreadySent) return;

        const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
        const html = milestoneEmail({
          name:        studentName || 'there',
          contentTitle: form.title,
          contentType:  isVE ? 'virtual_experience' : form.content_type,
          formUrl:     `${APP_URL}/${form.slug ?? formId}`,
        });

        await resend.emails.send({
          from: FROM,
          to:   email,
          subject: `You're 80% done -- finish strong! 🎯`,
          html,
        });
        await recordNudge(supabase, email, formId, 'milestone_80');
      } catch (err) {
        console.error('[guided-project-progress] milestone check failed', err);
      }
    })();
  }

  return NextResponse.json({ success: true });
}
