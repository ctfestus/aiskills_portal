import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdmissionRecord } from '@/lib/db-payments';
import { Resend } from 'resend';
import { cohortInviteEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

async function getSessionUser(req: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user?.email) return null;
  const { data: student } = await db.from('students').select('role').eq('id', user.id).single();
  return { id: user.id, email: user.email.trim().toLowerCase(), role: student?.role ?? 'student' };
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['instructor', 'admin'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cohortId, rows } = body;
  const db = adminClient();

  if (body.action === 'save-settings') {
    if (!cohortId || !body.settings) {
      return NextResponse.json({ error: 'cohortId and settings are required' }, { status: 400 });
    }

    const totalFee = Number(body.settings.total_fee);
    if (!totalFee || totalFee <= 0) {
      return NextResponse.json({ error: 'Total fee must be greater than 0.' }, { status: 400 });
    }

    const payload = {
      cohort_id:                   cohortId,
      total_fee:                   totalFee,
      currency:                    String(body.settings.currency || 'GHS').trim() || 'GHS',
      deposit_percent:             Number(body.settings.deposit_percent ?? 50),
      payment_plan:                body.settings.payment_plan || 'flexible',
      installment_count:           Number(body.settings.installment_count ?? 3),
      post_bootcamp_access_months: Number(body.settings.post_bootcamp_access_months ?? 3),
      updated_at:                  new Date().toISOString(),
    };

    const { error } = await db
      .from('cohort_payment_settings')
      .upsert(payload, { onConflict: 'cohort_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cascade start/end date to all enrollment rows for this cohort.
    // Pre-signup rows: updated so installments generate with the correct date at signup.
    // Post-signup rows: bootcamp_ends_at drives access_until -- update it and recompute
    // access for each. Installment due dates are NOT touched here; use the Edit
    // modal's installments section to adjust those individually.
    const startDate = body.settings.start_date ?? null;
    const endDate   = body.settings.end_date   ?? null;
    if (startDate) {
      await db
        .from('bootcamp_enrollments')
        .update({ bootcamp_starts_at: startDate, bootcamp_ends_at: endDate, updated_at: new Date().toISOString() })
        .eq('cohort_id', cohortId);

      // Recompute access for every post-signup enrollment so access_until reflects
      // the new end date.
      const { data: postSignup } = await db
        .from('bootcamp_enrollments')
        .select('id')
        .eq('cohort_id', cohortId)
        .not('student_id', 'is', null);

      if (postSignup && postSignup.length > 0) {
        const postBootcampMonths = Number(body.settings.post_bootcamp_access_months ?? 3);
        const { recomputeEnrollmentAccessPublic } = await import('@/lib/db-payments');
        await Promise.all(
          postSignup.map(e => recomputeEnrollmentAccessPublic(db, e.id, postBootcampMonths))
        );
      }
    }

    return NextResponse.json({ ok: true, settings: payload });
  }

  if (body.action === 'assign-student') {
    const { studentId } = body;
    if (!studentId || cohortId === undefined) {
      return NextResponse.json({ error: 'studentId and cohortId are required' }, { status: 400 });
    }

    try {
      const { data: student } = await db
        .from('students')
        .select('email')
        .eq('id', studentId)
        .single();
      if (!student?.email) throw new Error('Student email not found');

      const email = student.email.toLowerCase();

      // Do all enrollment work BEFORE touching students.cohort_id
      if (cohortId) {
        const { createAdmissionRecord, activateEnrollment } = await import('@/lib/db-payments');

        // Case 1: already has a post-signup enrollment for this cohort -- nothing to do
        const { data: existing } = await db
          .from('bootcamp_enrollments')
          .select('id')
          .eq('student_id', studentId)
          .eq('cohort_id', cohortId)
          .maybeSingle();

        if (!existing) {
          // Case 2: pre-signup row exists -- activate it
          const { data: presignup } = await db
            .from('bootcamp_enrollments')
            .select('id')
            .eq('email', email)
            .eq('cohort_id', cohortId)
            .is('student_id', null)
            .maybeSingle();

          if (presignup) {
            await activateEnrollment(db, email, cohortId, studentId);
          } else {
            // Case 3: no row at all -- create from cohort defaults then activate
            const [{ data: settings }, { data: cohortRow }] = await Promise.all([
              db.from('cohort_payment_settings').select('*').eq('cohort_id', cohortId).maybeSingle(),
              db.from('cohorts').select('start_date, end_date').eq('id', cohortId).maybeSingle(),
            ]);
            if (!settings?.total_fee || Number(settings.total_fee) <= 0) {
              throw new Error('Set payment settings for this cohort before assigning students.');
            }
            const depositRequired = Math.round(Number(settings.total_fee) * Number(settings.deposit_percent ?? 50)) / 100;
            await createAdmissionRecord(db, {
              email,
              cohortId,
              totalFee:         Number(settings.total_fee),
              currency:         settings.currency ?? 'GHS',
              paymentPlan:      settings.payment_plan ?? 'flexible',
              depositRequired,
              bootcampStartsAt: cohortRow?.start_date ?? null,
              bootcampEndsAt:   cohortRow?.end_date ?? null,
            });
            await activateEnrollment(db, email, cohortId, studentId);
          }
        }
      }

      // Enrollment confirmed -- now safe to update cohort
      const { error: assignErr } = await db
        .from('students')
        .update({ cohort_id: cohortId || null })
        .eq('id', studentId);
      if (assignErr) throw assignErr;

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to assign student' }, { status: 500 });
    }
  }

  if (!cohortId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'cohortId and rows are required' }, { status: 400 });
  }

  // Load cohort payment settings for defaults
  const [{ data: settings }, { data: cohort }] = await Promise.all([
    db.from('cohort_payment_settings').select('*').eq('cohort_id', cohortId).maybeSingle(),
    db.from('cohorts').select('start_date, end_date').eq('id', cohortId).maybeSingle(),
  ]);

  let inserted = 0;
  let updated = 0;
  const errors: { email: string; error: string }[] = [];
  const newEmails: string[] = [];

  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!email) continue;

    try {
      const total_fee = Number(row.total_fee || settings?.total_fee || 0);
      if (!total_fee || total_fee <= 0) {
        throw new Error('total_fee is required when cohort payment settings are not configured.');
      }

      const deposit_percent  = Number(settings?.deposit_percent ?? 50);
      const deposit_required = Math.round(total_fee * deposit_percent) / 100;
      const payment_plan     = row.payment_plan ?? settings?.payment_plan ?? 'flexible';
      const amount_paid      = Number(row.amount_paid ?? 0);
      const currency         = settings?.currency ?? 'GHS';

      // Upsert cohort_allowed_emails
      const { error: allowlistErr } = await db
        .from('cohort_allowed_emails')
        .upsert({ email, cohort_id: cohortId }, { onConflict: 'email' });
      if (allowlistErr) throw allowlistErr;

      // Check if pre-signup admission record already exists
      const { data: existing } = await db
        .from('bootcamp_enrollments')
        .select('id')
        .eq('email', email)
        .eq('cohort_id', cohortId)
        .is('student_id', null)
        .maybeSingle();

      await createAdmissionRecord(db, {
        email,
        fullName:          row.full_name ?? null,
        cohortId,
        totalFee:          total_fee,
        currency,
        paymentPlan:       payment_plan,
        depositRequired:   deposit_required,
        amountPaidInitial: amount_paid,
        paidAt:            row.paid_at ?? null,
        paymentMethod:     row.payment_method ?? null,
        paymentReference:  row.payment_reference ?? null,
        notes:             row.notes ?? null,
        bootcampStartsAt:  cohort?.start_date ?? null,
        bootcampEndsAt:    cohort?.end_date ?? null,
      });

      if (existing) {
        updated++;
      } else {
        inserted++;
        newEmails.push(email);
      }

      // Create payment audit record if amount paid and no record exists yet
      if (amount_paid > 0) {
        const { data: enrollment } = await db
          .from('bootcamp_enrollments')
          .select('id')
          .eq('email', email)
          .eq('cohort_id', cohortId)
          .is('student_id', null)
          .maybeSingle();

        if (enrollment) {
          const { data: existingPayment } = await db
            .from('payments')
            .select('id')
            .eq('enrollment_id', enrollment.id)
            .maybeSingle();

          if (!existingPayment) {
            const { error: paymentErr } = await db.from('payments').insert({
              enrollment_id: enrollment.id,
              payer_email:   email,
              cohort_id:     cohortId,
              amount:        amount_paid,
              paid_at:       row.paid_at ?? new Date().toISOString().slice(0, 10),
              method:        row.payment_method ?? null,
              reference:     row.payment_reference ?? null,
              notes:         row.notes ?? null,
            });
            if (paymentErr) throw paymentErr;
          }
        }
      }
    } catch (err: any) {
      errors.push({ email, error: err.message ?? 'Unknown error' });
    }
  }

  // Fire-and-forget invitation emails for newly inserted students
  if (newEmails.length > 0) {
    (async () => {
      try {
        const [{ data: cohortRow }, t] = await Promise.all([
          db.from('cohorts').select('name').eq('id', cohortId).maybeSingle(),
          getTenantSettings(),
        ]);
        const cohortName = cohortRow?.name ?? 'your cohort';
        const signupUrl  = process.env.APP_URL || t.appUrl || '';
        const FROM       = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding   = { appName: t.appName, appUrl: signupUrl, logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl };

        await resend.batch.send(
          newEmails.map(email => ({
            from: FROM,
            to: email,
            subject: `You've been invited to join ${t.appName || cohortName}`,
            html: cohortInviteEmail({ cohortName, signupUrl, branding }),
          }))
        );
      } catch {
        // non-blocking
      }
    })();
  }

  return NextResponse.json({ ok: true, inserted, updated, errors });
}

// GET /api/admissions?cohortId=xxx
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['instructor', 'admin'].includes(sessionUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cohortId = req.nextUrl.searchParams.get('cohortId');
  const db = adminClient();

  const { data: settings, error: settingsError } = cohortId
    ? await db.from('cohort_payment_settings').select('*').eq('cohort_id', cohortId).maybeSingle()
    : { data: null, error: null };
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  // Return pre-signup admission records for this cohort
  const query = db
    .from('bootcamp_enrollments')
    .select('id, email, full_name, total_fee, currency, payment_plan, deposit_required, amount_paid_initial, paid_at, payment_method, payment_reference, notes, created_at')
    .is('student_id', null)
    .order('created_at', { ascending: false });

  if (cohortId) query.eq('cohort_id', cohortId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ intakes: data ?? [], settings });
}
