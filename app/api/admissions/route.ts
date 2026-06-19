import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { createAdmissionRecord, activateEnrollment } from '@/lib/db-payments';
import { Resend } from 'resend';
import { studentAccountCreatedEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import { randomBytes } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

function makeTemporaryPassword() {
  return `${randomBytes(32).toString('base64url')}Aa1!`;
}

function appUrlFrom(settings: Awaited<ReturnType<typeof getTenantSettings>>) {
  return (process.env.APP_URL || settings.appUrl || '').replace(/\/$/, '');
}

function passwordSetupUrl(appUrl: string, tokenHash: string) {
  return `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
}

async function provisionStudentAccount(
  db: ReturnType<typeof adminClient>,
  input: { email: string; fullName?: string | null; cohortId: string; enrollmentId: string; appUrl: string },
) {
  const { email, cohortId, enrollmentId, appUrl } = input;
  const fullName = input.fullName?.trim() || null;

  const { data: existingStudent, error: existingStudentError } = await db
    .from('students')
    .select('id, role, full_name, account_provisioned_at')
    .eq('email', email)
    .maybeSingle();
  if (existingStudentError) throw existingStudentError;
  if (existingStudent && existingStudent.role !== 'student' && existingStudent.role !== 'staff') {
    throw new Error('This email already belongs to a staff or admin account.');
  }

  let studentId = existingStudent?.id as string | undefined;
  let createdUserId: string | null = null;

  if (!studentId) {
    const now = new Date().toISOString();
    const { data: created, error: createUserError } = await db.auth.admin.createUser({
      email,
      password: makeTemporaryPassword(),
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    });
    if (createUserError || !created.user) {
      throw createUserError ?? new Error('Could not create student account.');
    }
    studentId = created.user.id;
    createdUserId = created.user.id;

    const { error: profileError } = await db
      .from('students')
      .upsert({
        id:          studentId,
        email,
        full_name:   fullName,
        role:        'student',
        cohort_id:   cohortId,
        account_provisioned_at: now,
        updated_at:  now,
      }, { onConflict: 'id' });
    if (profileError) throw profileError;
  } else {
    const profilePatch: any = { cohort_id: cohortId, updated_at: new Date().toISOString() };
    if (fullName && !existingStudent?.full_name) profilePatch.full_name = fullName;
    if (!existingStudent?.account_provisioned_at) profilePatch.account_provisioned_at = new Date().toISOString();
    const { error: profileError } = await db.from('students').update(profilePatch).eq('id', studentId);
    if (profileError) throw profileError;
  }

  try {
    const { data: enrollment, error: enrollmentError } = await db
      .from('bootcamp_enrollments')
      .select('student_id')
      .eq('id', enrollmentId)
      .single();
    if (enrollmentError) throw enrollmentError;

    if (!enrollment.student_id) {
      await activateEnrollment(db, email, cohortId, studentId);
    } else if (enrollment.student_id !== studentId) {
      throw new Error('This admission record is already linked to a different student account.');
    }

    // Clean up any stale allowlist entry from the old signup-based flow.
    await db.from('cohort_allowed_emails').delete().eq('email', email);
  } catch (err) {
    if (createdUserId) await db.auth.admin.deleteUser(createdUserId).catch(() => {});
    throw err;
  }

  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (linkError || !link.properties?.hashed_token) {
    throw linkError ?? new Error('Could not generate first-access link.');
  }

  return {
    studentId,
    setupUrl: passwordSetupUrl(appUrl, link.properties.hashed_token),
    isNewAccount: Boolean(createdUserId),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'admin']);
  if (isAuthError(auth)) return auth.error;

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

    const graceDaysRaw = body.settings.grace_period_days;
    let gracePeriodDays: number | null = null;
    if (graceDaysRaw !== '' && graceDaysRaw != null) {
      const parsed = Number(graceDaysRaw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
        return NextResponse.json({ error: 'Grace period must be a whole number between 0 and 365.' }, { status: 400 });
      }
      gracePeriodDays = parsed;
    }

    const payload = {
      cohort_id:                   cohortId,
      total_fee:                   totalFee,
      currency:                    String(body.settings.currency || 'GHS').trim() || 'GHS',
      deposit_percent:             Number(body.settings.deposit_percent ?? 50),
      payment_plan:                body.settings.payment_plan || 'flexible',
      installment_count:           Number(body.settings.installment_count ?? 3),
      post_bootcamp_access_months: Number(body.settings.post_bootcamp_access_months ?? 3),
      grace_period_days:           gracePeriodDays,
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

        // Check if the student already has an active (post-signup) enrollment anywhere
        const { data: anyEnrollment } = await db
          .from('bootcamp_enrollments')
          .select('id, cohort_id')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyEnrollment) {
          // Student already enrolled -- just move the enrollment to the new cohort.
          // Payment history, installments, and paid amounts stay on the same row.
          if (anyEnrollment.cohort_id !== cohortId) {
            await db
              .from('bootcamp_enrollments')
              .update({ cohort_id: cohortId, updated_at: new Date().toISOString() })
              .eq('id', anyEnrollment.id);
          }
        } else {
          // No existing enrollment -- create one fresh.

          // Case 1: pre-signup row exists for this cohort -- activate it
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
            // Case 2: no row at all -- create from cohort defaults then activate
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
  const accountEmails: { email: string; name: string; setupUrl: string; isNewAccount: boolean }[] = [];
  const t = await getTenantSettings();
  const appUrl = appUrlFrom(t);
  if (!appUrl) {
    return NextResponse.json({ error: 'APP_URL or platform App URL must be configured before creating student accounts.' }, { status: 500 });
  }

  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!email) continue;

    try {
      const total_fee = Number(row.total_fee || settings?.total_fee || 0);
      if (!total_fee || total_fee <= 0) {
        throw new Error('total_fee is required when cohort payment settings are not configured.');
      }
      if (!cohort?.start_date) {
        throw new Error('Cohort start date is required before student accounts can be created.');
      }

      const deposit_percent  = Number(settings?.deposit_percent ?? 50);
      const deposit_required = Math.round(total_fee * deposit_percent) / 100;
      const payment_plan     = row.payment_plan ?? settings?.payment_plan ?? 'flexible';
      const amount_paid      = Number(row.amount_paid ?? 0);
      const currency         = settings?.currency ?? 'GHS';

      // Check if an admission/enrollment record already exists
      const { data: existing } = await db
        .from('bootcamp_enrollments')
        .select('id')
        .eq('email', email)
        .eq('cohort_id', cohortId)
        .maybeSingle();

      const enrollmentId = await createAdmissionRecord(db, {
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
      }

      // Create payment audit record if amount paid and no record exists yet
      if (amount_paid > 0) {
        const { data: enrollment } = await db
          .from('bootcamp_enrollments')
          .select('id')
          .eq('id', enrollmentId)
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

      const provisioned = await provisionStudentAccount(db, {
        email,
        fullName: row.full_name ?? null,
        cohortId,
        enrollmentId,
        appUrl,
      });
      accountEmails.push({
        email,
        name: row.full_name || 'there',
        setupUrl: provisioned.setupUrl,
        isNewAccount: provisioned.isNewAccount,
      });
    } catch (err: any) {
      errors.push({ email, error: err.message ?? 'Unknown error' });
    }
  }

  let setupEmailsSent = 0;
  if (accountEmails.length > 0) {
    if (!process.env.RESEND_API_KEY) {
      for (const account of accountEmails) {
        errors.push({ email: account.email, error: 'Account created, but RESEND_API_KEY is not configured so the setup email was not sent.' });
      }
    } else {
      try {
        const { data: cohortRow } = await db.from('cohorts').select('name').eq('id', cohortId).maybeSingle();
        const cohortName = cohortRow?.name ?? 'your cohort';
        const FROM       = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding   = { appName: t.appName, appUrl, logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName };

        await resend.batch.send(
          accountEmails.map(account => ({
            from: FROM,
            to: account.email,
            subject: `Your ${t.appName || cohortName} account is ready`,
            html: studentAccountCreatedEmail({
              name: account.name,
              cohortName,
              setupUrl: account.setupUrl,
              branding,
            }),
          }))
        );
        await db
          .from('students')
          .update({ setup_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('email', accountEmails.map(account => account.email));
        setupEmailsSent = accountEmails.length;
      } catch (err: any) {
        for (const account of accountEmails) {
          errors.push({ email: account.email, error: err?.message || 'Account created, but the setup email could not be sent.' });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, provisioned: accountEmails.length, setupEmailsSent, errors });
}

// GET /api/admissions?cohortId=xxx
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'admin']);
  if (isAuthError(auth)) return auth.error;

  const cohortId = req.nextUrl.searchParams.get('cohortId');
  const db = adminClient();

  const { data: settings, error: settingsError } = cohortId
    ? await db.from('cohort_payment_settings').select('*').eq('cohort_id', cohortId).maybeSingle()
    : { data: null, error: null };
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  // Return the full admission history for this cohort, including records that
  // have already been linked to provisioned student accounts.
  const query = db
    .from('bootcamp_enrollments')
    .select(`
      id,
      student_id,
      email,
      full_name,
      total_fee,
      currency,
      payment_plan,
      deposit_required,
      amount_paid_initial,
      paid_at,
      payment_method,
      payment_reference,
      notes,
      created_at,
      student:students(
        id,
        full_name,
        email,
        onboarding_done,
        account_provisioned_at,
        setup_email_sent_at,
        password_setup_started_at,
        password_set_at,
        onboarding_completed_at,
        last_login_at
      )
    `)
    .order('created_at', { ascending: false });

  if (cohortId) query.eq('cohort_id', cohortId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ admissions: data ?? [], intakes: data ?? [], settings });
}
