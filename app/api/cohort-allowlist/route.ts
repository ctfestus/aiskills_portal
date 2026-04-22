/**
 * GET  ?email=EMAIL       -- public, check if email is on any allowlist
 * GET  ?cohortId=UUID     -- admin-auth, list all emails for a cohort
 * POST                    -- admin-auth, add emails to a cohort allowlist
 * DELETE                  -- admin-auth, remove an email entry by id
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { cohortInviteEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const resend = new Resend(process.env.RESEND_API_KEY);

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

async function requireInstructor(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return null;
  const { data: student } = await adminClient()
    .from('students').select('role').eq('id', user.id).maybeSingle();
  if (!student || !['admin', 'instructor'].includes(student.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email    = searchParams.get('email');
  const cohortId = searchParams.get('cohortId');

  // --- Public: check if an email is allowed ---
  if (email) {
    const { data } = await adminClient()
      .from('cohort_allowed_emails')
      .select('cohort_id, cohorts(name)')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!data) return NextResponse.json({ allowed: false });
    return NextResponse.json({
      allowed: true,
      cohortId: data.cohort_id,
      cohortName: (data.cohorts as any)?.name ?? '',
    });
  }

  // --- Admin: list emails for a cohort ---
  if (cohortId) {
    const user = await requireInstructor(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await adminClient()
      .from('cohort_allowed_emails')
      .select('id, email, created_at')
      .eq('cohort_id', cohortId)
      .order('email');

    return NextResponse.json({ emails: data ?? [] });
  }

  return NextResponse.json({ error: 'Missing email or cohortId param' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const user = await requireInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cohortId, emails } = body;
  if (!cohortId || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'cohortId and emails[] are required' }, { status: 400 });
  }

  const normalised = emails
    .map((e: string) => e.toLowerCase().trim())
    .filter((e: string) => e.includes('@'));

  if (normalised.length === 0) {
    return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 });
  }

  // Single bulk query -- exclude emails already registered as students
  const { data: existing } = await adminClient()
    .from('students')
    .select('email')
    .in('email', normalised);
  const registeredSet = new Set((existing ?? []).map((s: { email: string }) => s.email));
  const skipped = normalised.filter(e => registeredSet.has(e));

  const rows = normalised
    .filter(e => !registeredSet.has(e))
    .map((email: string) => ({ cohort_id: cohortId, email, added_by: user.id }));

  if (rows.length === 0) {
    return NextResponse.json({
      error: skipped.length
        ? `All emails are already registered students: ${skipped.join(', ')}`
        : 'No valid emails provided',
    }, { status: 400 });
  }

  let data: any, error: any;
  const insert = await adminClient()
    .from('cohort_allowed_emails')
    .insert(rows)
    .select('id, email, created_at');

  if (insert.error) {
    const upsert = await adminClient()
      .from('cohort_allowed_emails')
      .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
      .select('id, email, created_at');
    data = upsert.data;
    error = upsert.error;
  } else {
    data = insert.data;
    error = insert.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget invitation emails
  const inserted: { email: string }[] = data ?? [];
  if (inserted.length > 0) {
    (async () => {
      try {
        const [{ data: cohort }, t] = await Promise.all([
          adminClient().from('cohorts').select('name').eq('id', cohortId).maybeSingle(),
          getTenantSettings(),
        ]);
        const cohortName = cohort?.name ?? 'your cohort';
        const signupUrl  = process.env.APP_URL || t.appUrl || '';
        const FROM       = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding   = { appName: t.appName, appUrl: signupUrl, logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl };

        await resend.batch.send(
          inserted.map(({ email }) => ({
            from: FROM,
            to: email,
            subject: `You've been invited to join ${t.appName || cohortName}`,
            html: cohortInviteEmail({ cohortName, signupUrl, branding }),
          }))
        );
      } catch {
        // non-blocking -- ignore email errors
      }
    })();
  }

  return NextResponse.json({ inserted, skipped });
}

export async function DELETE(req: NextRequest) {
  const user = await requireInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await adminClient()
    .from('cohort_allowed_emails')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
