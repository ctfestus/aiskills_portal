/**
 * POST /api/bulk-message
 * Sends a custom email to a filtered segment of students across the instructor's content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { blastEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';
const STALL_DAYS = 7;

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { segment, cohortId, formId, subject, messageBody } = body;

  if (!subject?.trim())     return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  if (!messageBody?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  if (!segment)             return NextResponse.json({ error: 'Segment is required' }, { status: 400 });
  if (subject.length > 200)      return NextResponse.json({ error: 'Subject must be 200 characters or fewer' }, { status: 400 });
  if (messageBody.length > 5000) return NextResponse.json({ error: 'Message body must be 5 000 characters or fewer' }, { status: 400 });

  // 1. Fetch instructor's courses and VEs -- optionally scoped to a single item
  const [{ data: coursesRaw }, { data: vesRaw }] = await Promise.all([
    formId
      ? supabase.from('courses').select('id, title, content_type:id, cohort_ids, slug').eq('user_id', user.id).eq('id', formId)
      : supabase.from('courses').select('id, title, cohort_ids, slug').eq('user_id', user.id),
    formId
      ? supabase.from('virtual_experiences').select('id, title, cohort_ids, slug').eq('user_id', user.id).eq('id', formId)
      : supabase.from('virtual_experiences').select('id, title, cohort_ids, slug').eq('user_id', user.id),
  ]);

  type ContentItem = { id: string; title: string; cohort_ids: string[]; slug: string; content_type: string };
  const allContent: ContentItem[] = [
    ...(coursesRaw ?? []).map((c: any) => ({ ...c, content_type: 'course' })),
    ...(vesRaw     ?? []).map((v: any) => ({ ...v, content_type: 'virtual_experience' })),
  ];

  if (!allContent.length) return NextResponse.json({ error: 'No content found' }, { status: 404 });

  // 2. Collect relevant cohort IDs
  const allCohortIds = [...new Set(allContent.flatMap(f => Array.isArray(f.cohort_ids) ? f.cohort_ids : []))];
  const activeCohortIds = cohortId && cohortId !== 'all'
    ? allCohortIds.filter(id => id === cohortId)
    : allCohortIds;

  if (!activeCohortIds.length) return NextResponse.json({ error: 'No cohorts assigned' }, { status: 404 });

  // 3. Fetch students
  const { data: students } = await supabase
    .from('students')
    .select('id, email, full_name, cohort_id')
    .in('cohort_id', activeCohortIds);

  if (!students?.length) return NextResponse.json({ error: 'No students found' }, { status: 404 });

  const courseIds = allContent.filter(f => f.content_type === 'course').map(f => f.id);
  const veIds     = allContent.filter(f => f.content_type === 'virtual_experience').map(f => f.id);

  // 4. Fetch attempts
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    courseIds.length
      ? supabase.from('course_attempts').select('student_id, course_id, completed_at, updated_at').in('course_id', courseIds)
      : Promise.resolve({ data: [] as any[] }),
    veIds.length
      ? supabase.from('guided_project_attempts').select('student_id, ve_id, completed_at, updated_at').in('ve_id', veIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Build attempt map: "studentId|contentId"
  const attemptMap = new Map<string, { completed: boolean; lastActive: string | null }>();
  for (const a of courseAttempts ?? []) {
    const key = `${a.student_id}|${a.course_id}`;
    const existing = attemptMap.get(key);
    const isNewer = !existing || (a.updated_at && (!existing.lastActive || a.updated_at > existing.lastActive));
    if (isNewer) attemptMap.set(key, { completed: !!a.completed_at, lastActive: a.updated_at ?? null });
  }
  for (const a of gpAttempts ?? []) {
    const key = `${a.student_id}|${a.ve_id}`;
    const existing = attemptMap.get(key);
    const isNewer = !existing || (a.updated_at && (!existing.lastActive || a.updated_at > existing.lastActive));
    if (isNewer) attemptMap.set(key, { completed: !!a.completed_at, lastActive: a.updated_at ?? null });
  }

  // 5. Build recipient list filtered by segment
  const seen     = new Set<string>();
  const recipients: { email: string; name: string }[] = [];

  for (const item of allContent) {
    const itemCohortIds = (Array.isArray(item.cohort_ids) ? item.cohort_ids : [])
      .filter((id: string) => activeCohortIds.includes(id));
    const itemStudents = students.filter(s => itemCohortIds.includes(s.cohort_id));

    for (const student of itemStudents) {
      const key     = `${student.id}|${item.id}`;
      const attempt = attemptMap.get(key);

      let status: string;
      if (!attempt) {
        status = 'not_started';
      } else if (attempt.completed) {
        status = 'completed';
      } else {
        const days = daysSince(attempt.lastActive);
        status = days !== null && days >= STALL_DAYS ? 'stalled' : 'in_progress';
      }

      if (segment !== 'all' && status !== segment) continue;

      const email = (student.email ?? '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (seen.has(email)) continue;
      seen.add(email);

      recipients.push({ email, name: student.full_name || 'there' });
    }
  }

  if (!recipients.length) {
    return NextResponse.json({ error: 'No recipients match this segment', sent: 0 }, { status: 200 });
  }

  // 6. Send in batches of 100
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients.slice(i, i + 100).map(({ email, name }) => {
      const personalBody = messageBody.replace(/\{\{name\}\}/gi, name);
      const html = blastEmail({
        subject,
        body:       personalBody,
        formTitle:  'AI Skills Africa',
        formUrl:    `${APP_URL}/student`,
        senderName: 'AI Skills Africa - Learning Experience Team',
      });
      return { from: FROM, to: email, subject, html };
    });
    await resend.batch.send(batch);
    sent += batch.length;
  }

  return NextResponse.json({ ok: true, sent });
}
