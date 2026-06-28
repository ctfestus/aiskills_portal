import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { admitStudents } from '@/lib/admit-students';

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
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

  const result = await admitStudents(db, cohortId, rows);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, ...result });
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
