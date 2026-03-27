import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { confirmationEmail, reminderEmail, courseResultEmail, blastEmail } from '@/lib/email-templates';

// In-memory rate limiter for test email sends -- max 5 per creator per hour.
// Uses a hash of the JWT as key so full tokens are never stored.
const testEmailRateLimit = new Map<string, { count: number; resetAt: number }>();
function allowTestEmailSend(jwt: string): boolean {
  const key = createHash('sha256').update(jwt).digest('hex').slice(0, 16);
  const now = Date.now();
  const entry = testEmailRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    testEmailRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <notifications@festforms.com>';

const getAdminSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
};

// Returns the authenticated creator's user ID from a Bearer token, or null.
async function getCreatorId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const supabase = getAdminSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Returns true if creatorId owns the given formId.
async function ownsForm(creatorId: string, formId: string): Promise<boolean> {
  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from('forms')
    .select('id')
    .eq('id', formId)
    .eq('user_id', creatorId)
    .single();
  return !!data;
}


async function sendBatch(emails: string[], subject: string, html: string) {
  const unique = [...new Set(emails.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!unique.length) return;
  // Resend batch: max 100 per call
  for (let i = 0; i < unique.length; i += 100) {
    await resend.batch.send(
      unique.slice(i, i + 100).map(to => ({ from: FROM, to, subject, html }))
    );
  }
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveName(data: Record<string, any>) {
  const fullName = String(data.full_name || data.name || '').trim();
  if (fullName) return fullName;
  const firstName = String(data.first_name || '').trim();
  const lastName = String(data.last_name || '').trim();
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function applyMergeTags(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key) => {
    const normalizedKey = String(key).toLowerCase();
    return values[normalizedKey] ?? '';
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  try {
    const { type, to, data } = await req.json();

    if (!type || (!to && !data?.formId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // -- Per-type authorization ---
    let blastCreatorId = '';

    if (type === 'blast') {
      // Requires authenticated creator who owns the form
      const creatorId = await getCreatorId(req);
      if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      if (!data?.formId || !(await ownsForm(creatorId, data.formId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      blastCreatorId = creatorId;
    } else if (type === 'reminder') {
      const cronSecret = process.env.CRON_SECRET;
      const cronHeader = req.headers.get('x-cron-secret');
      const isCron = cronSecret && cronHeader === cronSecret;

      if (!isCron) {
        // Creator path -- fully handled here, returns early
        const creatorId = await getCreatorId(req);
        if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (!data?.formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });
        if (!(await ownsForm(creatorId, data.formId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Validate form is actually an event
        const supabase = getAdminSupabase();
        const { data: form } = await supabase.from('forms').select('config').eq('id', data.formId).single();
        if (!form?.config?.eventDetails?.isEvent) {
          return NextResponse.json({ error: 'This form is not an event' }, { status: 400 });
        }

        const reminderSubject = data.isOneHour ? `Starting in 1 hour: ${data.eventTitle}` : `Tomorrow: ${data.eventTitle}`;
        const reminderHtml = reminderEmail(data);

        if (typeof to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
          // Test mode: creator provided a single email -- send once
          await resend.emails.send({ from: FROM, to: to.trim(), subject: reminderSubject, html: reminderHtml });
          return NextResponse.json({ success: true, test: true });
        }

        // Production mode: derive recipients from DB
        const { data: responses } = await supabase.from('responses').select('data').eq('form_id', data.formId);
        const emails = [...new Set(
          (responses || [])
            .map((r: any) => String(r.data?.email || '').trim().toLowerCase())
            .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        )];
        if (!emails.length) return NextResponse.json({ error: 'No valid recipients found' }, { status: 400 });
        await sendBatch(emails, reminderSubject, reminderHtml);
        return NextResponse.json({ success: true, count: emails.length });
      }
      // Cron path falls through to switch/send below
    } else if (type === 'confirmation' || type === 'course-result') {
      // Test mode: single email + no responseId -> creator-initiated test send
      if (typeof to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) && !data?.responseId) {
        const auth = req.headers.get('authorization') ?? '';
        const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!allowTestEmailSend(jwt)) {
          return NextResponse.json(
            { error: 'Test email rate limit reached. Maximum 5 test sends per hour.' },
            { status: 429 }
          );
        }
        const subject = type === 'confirmation'
          ? `You're registered: ${data?.eventTitle || 'Event'}`
          : `Your result: ${data?.courseTitle || 'Course'}`;
        const html = type === 'confirmation' ? confirmationEmail(data) : courseResultEmail(data);
        await resend.emails.send({ from: FROM, to: to.trim(), subject, html });
        return NextResponse.json({ success: true, test: true });
      }
      // Verify: response exists, belongs to this form, and stored email matches `to`
      if (!data?.formId || !data?.responseId || !to) {
        return NextResponse.json({ error: 'formId, responseId and to are required' }, { status: 400 });
      }
      const supabase = getAdminSupabase();
      const { data: response } = await supabase
        .from('responses')
        .select('data')
        .eq('id', data.responseId)
        .eq('form_id', data.formId)
        .single();
      if (!response) {
        return NextResponse.json({ error: 'Response not found' }, { status: 404 });
      }
      const storedEmail = String(response.data?.email ?? '').trim().toLowerCase();
      const requestedEmail = String(typeof to === 'string' ? to : '').trim().toLowerCase();
      if (!storedEmail || storedEmail !== requestedEmail) {
        return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
      }

      // Idempotency: don't resend if already sent for this response + type
      const { data: alreadySent } = await supabase
        .from('sent_emails')
        .select('id')
        .eq('response_id', data.responseId)
        .eq('type', type)
        .maybeSingle();
      if (alreadySent) return NextResponse.json({ success: true, duplicate: true });
    }

    // For course-result, derive all content from the DB -- never trust client values
    let courseResultData: Record<string, any> | null = null;
    if (type === 'course-result') {
      const supabase = getAdminSupabase();

      const [{ data: form }, { data: cert }] = await Promise.all([
        supabase.from('forms').select('config, slug').eq('id', data.formId).single(),
        supabase.from('certificates').select('id').eq('response_id', data.responseId).eq('revoked', false).maybeSingle(),
      ]);

      const { data: response } = await supabase
        .from('responses').select('data').eq('id', data.responseId).eq('form_id', data.formId).single();

      const appUrl = process.env.APP_URL || 'https://festforms.com';
      const formUrl = form?.slug ? `${appUrl}/${form.slug}` : `${appUrl}/${data.formId}`;
      const certUrl = cert?.id ? `${appUrl}/certificate/${cert.id}` : undefined;

      courseResultData = {
        name:        response?.data?.name,
        courseTitle: form?.config?.title || '',
        score:       response?.data?.score       ?? 0,
        total:       response?.data?.total       ?? 0,
        percentage:  response?.data?.percentage  ?? 0,
        passed:      response?.data?.passed      ?? false,
        points:      response?.data?.points,
        passmark:    form?.config?.passmark       ?? 50,
        formUrl,
        certUrl,
      };
    }

    let html = '';
    let subject = '';

    switch (type) {
      case 'confirmation':
        subject = `You're registered: ${data.eventTitle}`;
        html = confirmationEmail(data);
        break;

      case 'reminder':
        subject = data.isOneHour
          ? `Starting in 1 hour: ${data.eventTitle}`
          : `Tomorrow: ${data.eventTitle}`;
        html = reminderEmail(data);
        break;

      case 'course-result': {
        const d = courseResultData!;
        subject = `Your result: ${d.percentage}% ${d.passed ? '✓ Passed' : '-- ' + d.courseTitle}`;
        html = courseResultEmail(d as Parameters<typeof courseResultEmail>[0]);
        break;
      }

      case 'blast':
        if (!data.subject?.trim()) {
          return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }
        if (!data.formId) {
          return NextResponse.json({ error: 'formId is required for broadcast emails' }, { status: 400 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
    }

    if (type === 'blast') {
      // -- Test mode: single email address provided -> send once, skip quota --
      if (typeof to === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
        if (!data.subject?.trim()) {
          return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }
        const testTo = to.trim();
        const mergeValues: Record<string, string> = {
          name: 'there', email: testTo,
          form_title: String(data.formTitle || ''),
          event_title: String(data.eventTitle || data.formTitle || ''),
          event_date: String(data.eventDate || ''),
          event_time: String(data.eventTime || ''),
          event_timezone: String(data.eventTimezone || ''),
          event_location: String(data.eventLocation || ''),
          meeting_link: String(data.meetingLink || ''),
          form_url: String(data.formUrl || ''),
        };
        const testSubject = applyMergeTags(String(data.subject || ''), mergeValues);
        const testBody = applyMergeTags(String(data.body || ''), mergeValues);
        const testHtml = blastEmail({ ...data, subject: testSubject, body: testBody });
        await resend.emails.send({ from: FROM, to: testTo, subject: testSubject, html: testHtml });
        return NextResponse.json({ success: true, test: true });
      }

      // -- Daily blast quota ---
      const BLAST_DAILY_LIMIT = 10;
      const today = new Date().toISOString().split('T')[0];
      const supabase = getAdminSupabase();

      const { data: quota } = await supabase
        .from('blast_quotas')
        .select('count')
        .eq('creator_id', blastCreatorId)
        .eq('date', today)
        .maybeSingle();

      const currentCount = quota?.count ?? 0;
      if (currentCount >= BLAST_DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Daily blast limit of ${BLAST_DAILY_LIMIT} reached. Try again tomorrow.` },
          { status: 429 }
        );
      }

      // Load recipients from DB -- never trust the client-supplied to list
      const [{ data: responses, error }, { data: formRow }] = await Promise.all([
        supabase.from('responses').select('data').eq('form_id', data.formId),
        supabase.from('forms').select('cohort_ids').eq('id', data.formId).single(),
      ]);

      if (error) throw error;

      // Build deduplicated map of email -> merge data (responses first, then cohort students fill gaps)
      const responseByEmail = new Map<string, Record<string, any>>();

      for (const response of responses || []) {
        const rowData = (response as any)?.data || {};
        const emailKey = normalizeEmail(rowData.email);
        if (emailKey && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey) && !responseByEmail.has(emailKey)) {
          responseByEmail.set(emailKey, rowData);
        }
      }

      // Also include students assigned via cohorts (catches students who haven't completed yet)
      const cohortIds: string[] = Array.isArray(formRow?.cohort_ids) ? formRow.cohort_ids : [];
      if (cohortIds.length > 0) {
        const { data: cohortStudents } = await supabase
          .from('students')
          .select('full_name, email')
          .in('cohort_id', cohortIds);

        for (const student of cohortStudents || []) {
          const emailKey = normalizeEmail(student.email);
          if (emailKey && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey) && !responseByEmail.has(emailKey)) {
            responseByEmail.set(emailKey, { name: student.full_name, email: student.email });
          }
        }
      }

      if (!responseByEmail.size) {
        return NextResponse.json({ error: 'No valid recipients found for this form' }, { status: 400 });
      }

      for (const [recipient, rowData] of responseByEmail) {
        const mergeValues: Record<string, string> = {
          name: resolveName(rowData) || 'there',
          email: recipient,
          form_title: String(data.formTitle || ''),
          event_title: String(data.eventTitle || data.formTitle || ''),
          event_date: String(data.eventDate || ''),
          event_time: String(data.eventTime || ''),
          event_timezone: String(data.eventTimezone || ''),
          event_location: String(data.eventLocation || ''),
          meeting_link: String(data.meetingLink || ''),
          form_url: String(data.formUrl || ''),
        };

        const personalizedSubject = applyMergeTags(String(data.subject || ''), mergeValues);
        const personalizedBody = applyMergeTags(String(data.body || ''), mergeValues);
        const personalizedHtml = blastEmail({
          ...data,
          subject: personalizedSubject,
          body: personalizedBody,
        });

        await resend.emails.send({
          from: FROM,
          to: recipient,
          subject: personalizedSubject,
          html: personalizedHtml,
        });
      }

      // Increment daily blast quota
      await supabase.from('blast_quotas').upsert(
        { creator_id: blastCreatorId, date: today, count: currentCount + 1 },
        { onConflict: 'creator_id,date' }
      );

      return NextResponse.json({ success: true, count: responseByEmail.size });
    } else if (Array.isArray(to)) {
      await sendBatch(to, subject, html);
    } else if (typeof to === 'string') {
      await resend.emails.send({ from: FROM, to, subject, html });
      // Record idempotency key so this confirmation/course-result isn't sent twice
      if ((type === 'confirmation' || type === 'course-result') && data?.responseId) {
        await getAdminSupabase().from('sent_emails').insert({ response_id: data.responseId, type });
      }
    } else {
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[email]', err);
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}
