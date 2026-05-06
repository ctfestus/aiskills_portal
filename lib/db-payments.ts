import { SupabaseClient } from '@supabase/supabase-js';
import { computeAccess, EnrollmentState } from './enrollment-access';

// ---
// Types
// ---

export interface EnrollmentRow {
  enrollment_id: string;
  student_id: string | null;
  student_name: string;
  email: string;
  cohort_id: string;
  cohort_name: string;
  original_cohort_id: string | null;
  original_cohort_name: string | null;
  payment_plan: string;
  total_fee: number;
  deposit_required: number;
  paid_total: number;
  balance: number;
  access_status: string;
  access_until: string | null;
  next_due_date: string | null;
  bootcamp_starts_at: string | null;
  bootcamp_ends_at: string | null;
  payment_exempt: boolean;
  currency: string;
  is_presignup: boolean;
}

export interface RecordPaymentInput {
  enrollmentId: string;
  amount: number;
  paidAt?: string;
  method?: string;
  reference?: string;
  notes?: string;
  payerEmail: string;
  cohortId: string;
  studentId?: string;
  confirmationId?: string;
}

// ---
// getEnrollmentRows
// Returns all post-signup enrollments enriched with cohort and student info.
// ---

export async function getEnrollmentRows(db: SupabaseClient): Promise<{ rows: EnrollmentRow[]; cohorts: { id: string; name: string }[] }> {
  const [enrollRes, cohortsRes, settingsRes] = await Promise.all([
    db
      .from('bootcamp_enrollments')
      .select(`
        id,
        student_id,
        cohort_id,
        email,
        full_name,
        total_fee,
        currency,
        payment_plan,
        deposit_required,
        paid_total,
        access_status,
        access_until,
        bootcamp_starts_at,
        bootcamp_ends_at,
        students ( full_name, email, original_cohort_id, payment_exempt, cohort_id ),
        cohorts ( name ),
        payment_installments ( due_date, status )
      `)
      .order('created_at', { ascending: false }),
    db.from('cohorts').select('id, name').order('name'),
    db.from('cohort_payment_settings').select('cohort_id, post_bootcamp_access_months'),
  ]);

  const cohortMap: Record<string, string> = {};
  for (const c of cohortsRes.data ?? []) cohortMap[c.id] = c.name;

  const settingsMap: Record<string, number> = {};
  for (const s of settingsRes.data ?? []) settingsMap[s.cohort_id] = s.post_bootcamp_access_months ?? 3;

  const toUpdate: { id: string; access_status: string; access_until: string | null }[] = [];

  const rows: EnrollmentRow[] = (enrollRes.data ?? []).map((e: any) => {
    const isPresignup = !e.student_id;
    const student = e.students ?? {};
    const rawInstallments = e.payment_installments ?? [];

    const nextUnpaid = rawInstallments
      .filter((i: any) => i.status === 'unpaid' || i.status === 'partial')
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    const originalCohortId = student.original_cohort_id ?? null;
    const resolvedCohortId = isPresignup ? e.cohort_id : (student.cohort_id ?? e.cohort_id);

    // Recompute access live so overdue status is always current-date-accurate
    const state: EnrollmentState = {
      payment_plan:                e.payment_plan as any,
      total_fee:                   Number(e.total_fee),
      deposit_required:            Number(e.deposit_required),
      paid_total:                  Number(e.paid_total),
      bootcamp_ends_at:            e.bootcamp_ends_at ? new Date(e.bootcamp_ends_at) : null,
      post_bootcamp_access_months: settingsMap[e.cohort_id] ?? 3,
      installments:                rawInstallments.map((i: any) => ({ due_date: new Date(i.due_date), status: i.status })),
    };
    const liveAccess  = computeAccess(state);
    const liveStatus  = liveAccess.access_status;
    const liveUntil   = liveAccess.access_until ? liveAccess.access_until.toISOString().slice(0, 10) : null;

    if (liveStatus !== e.access_status || liveUntil !== (e.access_until ?? null)) {
      toUpdate.push({ id: e.id, access_status: liveStatus, access_until: liveUntil });
    }

    return {
      enrollment_id:        e.id,
      student_id:           e.student_id ?? null,
      student_name:         isPresignup ? (e.full_name ?? '') : (student.full_name ?? ''),
      email:                isPresignup ? e.email : (student.email ?? e.email),
      cohort_id:            resolvedCohortId,
      cohort_name:          cohortMap[resolvedCohortId] ?? 'Unknown',
      original_cohort_id:   originalCohortId,
      original_cohort_name: originalCohortId ? (cohortMap[originalCohortId] ?? 'Unknown') : null,
      payment_plan:         e.payment_plan,
      total_fee:            Number(e.total_fee),
      deposit_required:     Number(e.deposit_required),
      paid_total:           Number(e.paid_total),
      balance:              Math.max(0, Number(e.total_fee) - Number(e.paid_total)),
      access_status:        liveStatus,
      access_until:         liveUntil,
      next_due_date:        nextUnpaid?.due_date ?? null,
      bootcamp_starts_at:   e.bootcamp_starts_at ?? null,
      bootcamp_ends_at:     e.bootcamp_ends_at ?? null,
      payment_exempt:       student.payment_exempt ?? false,
      currency:             e.currency ?? 'GHS',
      is_presignup:         isPresignup,
    };
  });

  // Persist changed statuses back to DB so student page also sees the correct value.
  // Fire and forget -- don't block the response.
  if (toUpdate.length > 0) {
    Promise.all(
      toUpdate.map(u => db.from('bootcamp_enrollments').update({
        access_status: u.access_status,
        access_until:  u.access_until,
        updated_at:    new Date().toISOString(),
      }).eq('id', u.id))
    ).catch(() => {});
  }

  return { rows, cohorts: cohortsRes.data ?? [] };
}

// ---
// createAdmissionRecord
// Creates a pre-signup enrollment row (student_id = null).
// Called by the admissions import. Upserts on (email, cohort_id).
// ---

export async function createAdmissionRecord(
  db: SupabaseClient,
  input: {
    email: string;
    fullName?: string | null;
    cohortId: string;
    totalFee: number;
    currency?: string;
    paymentPlan: 'full' | 'flexible' | 'sponsored' | 'waived';
    depositRequired: number;
    amountPaidInitial?: number;
    paidAt?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
    bootcampStartsAt?: string | null;
    bootcampEndsAt?: string | null;
  },
): Promise<string> {
  const email = input.email.toLowerCase();
  const amountPaid = input.amountPaidInitial ?? 0;

  const { data: existing } = await db
    .from('bootcamp_enrollments')
    .select('id')
    .eq('email', email)
    .eq('cohort_id', input.cohortId)
    .is('student_id', null)
    .maybeSingle();

  const payload: any = {
    email,
    full_name:           input.fullName ?? null,
    cohort_id:           input.cohortId,
    total_fee:           input.totalFee,
    currency:            input.currency ?? 'GHS',
    payment_plan:        input.paymentPlan,
    deposit_required:    input.depositRequired,
    amount_paid_initial: amountPaid,
    paid_at:             input.paidAt ?? null,
    payment_method:      input.paymentMethod ?? null,
    payment_reference:   input.paymentReference ?? null,
    notes:               input.notes ?? null,
    paid_total:          amountPaid,
    access_status:       'pending_deposit',
    bootcamp_starts_at:  input.bootcampStartsAt ?? null,
    bootcamp_ends_at:    input.bootcampEndsAt ?? null,
    updated_at:          new Date().toISOString(),
  };

  if (existing?.id) {
    // If a payment record already exists, treat amount_paid_initial as immutable --
    // do not update it or paid_total to avoid desyncing payment history from the enrollment total.
    const { data: existingPayment } = await db
      .from('payments')
      .select('id')
      .eq('enrollment_id', existing.id)
      .maybeSingle();

    const updatePayload = existingPayment
      ? (({ amount_paid_initial, paid_total, paid_at, payment_method, payment_reference, ...rest }) => rest)(payload)
      : payload;

    const { error } = await db
      .from('bootcamp_enrollments')
      .update(updatePayload)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await db
    .from('bootcamp_enrollments')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ---
// activateEnrollment
// Called from auth/callback when a student signs up.
// Sets student_id on the pre-signup row, generates installments,
// applies any initial payment, and computes access_status.
// ---

export async function activateEnrollment(
  db: SupabaseClient,
  email: string,
  cohortId: string,
  studentId: string,
): Promise<void> {
  const { data: enrollment, error } = await db
    .from('bootcamp_enrollments')
    .select('id, total_fee, deposit_required, payment_plan, amount_paid_initial, bootcamp_starts_at, cohort_id')
    .eq('email', email.toLowerCase())
    .eq('cohort_id', cohortId)
    .is('student_id', null)
    .maybeSingle();

  if (error) throw error;
  if (!enrollment) throw new Error('No admission record found for this email and cohort.');

  const { error: activateErr } = await db
    .from('bootcamp_enrollments')
    .update({ student_id: studentId, updated_at: new Date().toISOString() })
    .eq('id', enrollment.id);
  if (activateErr) throw activateErr;

  const { data: settings } = await db
    .from('cohort_payment_settings')
    .select('installment_count, post_bootcamp_access_months')
    .eq('cohort_id', cohortId)
    .maybeSingle();

  const installments = generateInstallments(
    enrollment.id,
    Number(enrollment.total_fee),
    Number(enrollment.deposit_required),
    settings?.installment_count ?? 2,
    enrollment.bootcamp_starts_at ? new Date(enrollment.bootcamp_starts_at) : null,
  );
  if (installments.length > 0) {
    const { error: instErr } = await db.from('payment_installments').insert(installments);
    if (instErr) throw instErr;
  }

  if (Number(enrollment.amount_paid_initial) > 0) {
    await applyAmountToInstallments(db, enrollment.id, Number(enrollment.amount_paid_initial));
  }

  await recomputeEnrollmentAccess(db, enrollment.id, settings?.post_bootcamp_access_months ?? 3);
}

// ---
// recordPayment
// Inserts a payment, applies it to installments oldest-first,
// updates paid_total, recomputes access_status + access_until.
// ---

export async function recordPayment(db: SupabaseClient, input: RecordPaymentInput): Promise<void> {
  const { error: payErr } = await db.from('payments').insert({
    enrollment_id:   input.enrollmentId,
    student_id:      input.studentId ?? null,
    payer_email:     input.payerEmail,
    cohort_id:       input.cohortId,
    amount:          input.amount,
    paid_at:         input.paidAt ?? new Date().toISOString().slice(0, 10),
    method:          input.method ?? null,
    reference:       input.reference ?? null,
    notes:           input.notes ?? null,
    confirmation_id: input.confirmationId ?? null,
  });
  if (payErr) throw payErr;

  const { data: installments, error: instErr } = await db
    .from('payment_installments')
    .select('id, due_date, amount_due, amount_paid, status')
    .eq('enrollment_id', input.enrollmentId)
    .in('status', ['unpaid', 'partial'])
    .order('due_date', { ascending: true });
  if (instErr) throw instErr;

  let remaining = input.amount;
  for (const inst of installments ?? []) {
    if (remaining <= 0) break;
    const owed = Number(inst.amount_due) - Number(inst.amount_paid);
    const applying = Math.min(remaining, owed);
    const newPaid = Number(inst.amount_paid) + applying;
    const newStatus = newPaid >= Number(inst.amount_due) ? 'paid' : 'partial';
    const { error: updErr } = await db
      .from('payment_installments')
      .update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', inst.id);
    if (updErr) throw updErr;
    remaining -= applying;
  }

  const { data: enroll, error: enErr } = await db
    .from('bootcamp_enrollments')
    .select('total_fee, deposit_required, paid_total, payment_plan, bootcamp_ends_at, cohort_id')
    .eq('id', input.enrollmentId)
    .single();
  if (enErr || !enroll) throw enErr ?? new Error('Enrollment not found');

  const { data: settings } = await db
    .from('cohort_payment_settings')
    .select('post_bootcamp_access_months')
    .eq('cohort_id', enroll.cohort_id)
    .maybeSingle();

  const { data: freshInst } = await db
    .from('payment_installments')
    .select('due_date, status')
    .eq('enrollment_id', input.enrollmentId);

  const newPaidTotal = Number(enroll.paid_total) + input.amount;

  const state: EnrollmentState = {
    payment_plan:                enroll.payment_plan as any,
    total_fee:                   Number(enroll.total_fee),
    deposit_required:            Number(enroll.deposit_required),
    paid_total:                  newPaidTotal,
    bootcamp_ends_at:            enroll.bootcamp_ends_at ? new Date(enroll.bootcamp_ends_at) : null,
    post_bootcamp_access_months: settings?.post_bootcamp_access_months ?? 3,
    installments:                (freshInst ?? []).map((i: any) => ({ due_date: new Date(i.due_date), status: i.status })),
  };

  const access = computeAccess(state);

  const { error: enrollUpdErr } = await db
    .from('bootcamp_enrollments')
    .update({
      paid_total:    newPaidTotal,
      access_status: access.access_status,
      access_until:  access.access_until ? access.access_until.toISOString().slice(0, 10) : null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', input.enrollmentId);
  if (enrollUpdErr) throw enrollUpdErr;
}

// ---
// generateInstallments
// ---

export function generateInstallments(
  enrollmentId: string,
  totalFee: number,
  depositRequired: number,
  installmentCount: number,
  bootcampStartsAt: Date | null,
): { enrollment_id: string; due_date: string; amount_due: number; amount_paid: number; status: string }[] {
  const rows = [];
  if (!bootcampStartsAt) throw new Error('Cohort start date must be set before installments can be generated. Update the cohort start date in Payment Settings.');

  const today = new Date().toISOString().slice(0, 10);

  rows.push({
    enrollment_id: enrollmentId,
    due_date:      today,
    amount_due:    depositRequired,
    amount_paid:   0,
    status:        'unpaid',
  });

  if (installmentCount <= 1) return rows;

  const remainder = totalFee - depositRequired;
  const count = installmentCount - 1;
  const perInstallment = Math.round((remainder / count) * 100) / 100;
  const base = bootcampStartsAt;

  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    rows.push({
      enrollment_id: enrollmentId,
      due_date:      d.toISOString().slice(0, 10),
      amount_due:    i === count ? Math.round((remainder - perInstallment * (count - 1)) * 100) / 100 : perInstallment,
      amount_paid:   0,
      status:        'unpaid',
    });
  }

  return rows;
}

// ---
// markOutstanding
// ---

export async function markOutstanding(
  db: SupabaseClient,
  studentId: string,
  outstandingCohortId: string,
): Promise<{ alreadyMoved: boolean }> {
  const { data: student, error } = await db
    .from('students')
    .select('cohort_id, original_cohort_id')
    .eq('id', studentId)
    .single();
  if (error || !student) throw error ?? new Error('Student not found');
  if (student.cohort_id === outstandingCohortId) return { alreadyMoved: true };

  const { error: moveErr } = await db
    .from('students')
    .update({
      original_cohort_id: student.cohort_id,
      cohort_id:          outstandingCohortId,
    })
    .eq('id', studentId);
  if (moveErr) throw moveErr;

  return { alreadyMoved: false };
}

// ---
// restoreAccess
// ---

export async function restoreAccess(db: SupabaseClient, studentId: string): Promise<void> {
  const { data: student, error } = await db
    .from('students')
    .select('original_cohort_id')
    .eq('id', studentId)
    .single();
  if (error || !student) throw error ?? new Error('Student not found');
  if (!student.original_cohort_id) throw new Error('No original cohort saved for this student');

  const { error: restoreErr } = await db
    .from('students')
    .update({
      cohort_id:          student.original_cohort_id,
      original_cohort_id: null,
      payment_exempt:     true,
    })
    .eq('id', studentId);
  if (restoreErr) throw restoreErr;
}

// ---
// getPaymentHistory
// Returns all payment records for a single enrollment, newest first.
// ---

export async function getPaymentHistory(
  db: SupabaseClient,
  enrollmentId: string,
): Promise<{ id: string; amount: number; paid_at: string; method: string | null; reference: string | null; notes: string | null; created_at: string }[]> {
  const { data, error } = await db
    .from('payments')
    .select('id, amount, paid_at, method, reference, notes, created_at')
    .eq('enrollment_id', enrollmentId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---
// editPayment
// Updates a payment record then recomputes paid_total + access.
// ---

export async function editPayment(
  db: SupabaseClient,
  paymentId: string,
  updates: { amount?: number; paid_at?: string; method?: string | null; reference?: string | null; notes?: string | null },
): Promise<void> {
  const { data: existing, error: fetchErr } = await db
    .from('payments')
    .select('enrollment_id')
    .eq('id', paymentId)
    .single();
  if (fetchErr || !existing) throw fetchErr ?? new Error('Payment not found');

  const { error: updErr } = await db
    .from('payments')
    .update(updates)
    .eq('id', paymentId);
  if (updErr) throw updErr;

  await reapplyAllPayments(db, existing.enrollment_id);
}

// ---
// deletePayment
// Deletes a payment record then recomputes paid_total + access.
// ---

export async function deletePayment(
  db: SupabaseClient,
  paymentId: string,
): Promise<void> {
  const { data: existing, error: fetchErr } = await db
    .from('payments')
    .select('enrollment_id')
    .eq('id', paymentId)
    .single();
  if (fetchErr || !existing) throw fetchErr ?? new Error('Payment not found');

  const { error: delErr } = await db.from('payments').delete().eq('id', paymentId);
  if (delErr) throw delErr;

  await reapplyAllPayments(db, existing.enrollment_id);
}

// ---
// Internal helpers
// ---

// Resets all installments to unpaid, then re-applies every payment in
// paid_at order so paid_total and installment statuses are always consistent.
async function reapplyAllPayments(db: SupabaseClient, enrollmentId: string): Promise<void> {
  const { data: settings_enrollment, error: enErr } = await db
    .from('bootcamp_enrollments')
    .select('cohort_id')
    .eq('id', enrollmentId)
    .single();
  if (enErr || !settings_enrollment) throw enErr ?? new Error('Enrollment not found');

  const { data: settings } = await db
    .from('cohort_payment_settings')
    .select('post_bootcamp_access_months')
    .eq('cohort_id', settings_enrollment.cohort_id)
    .maybeSingle();

  // Reset all installments
  const { error: resetErr } = await db
    .from('payment_installments')
    .update({ amount_paid: 0, status: 'unpaid', updated_at: new Date().toISOString() })
    .eq('enrollment_id', enrollmentId);
  if (resetErr) throw resetErr;

  // Fetch all remaining payments in chronological order
  const { data: allPayments, error: payErr } = await db
    .from('payments')
    .select('amount')
    .eq('enrollment_id', enrollmentId)
    .order('paid_at', { ascending: true });
  if (payErr) throw payErr;

  const newPaidTotal = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  // Re-apply each payment to installments in order
  for (const p of allPayments ?? []) {
    await applyAmountToInstallments(db, enrollmentId, Number(p.amount));
  }

  // Update paid_total on enrollment
  const { error: totErr } = await db
    .from('bootcamp_enrollments')
    .update({ paid_total: newPaidTotal, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId);
  if (totErr) throw totErr;

  await recomputeEnrollmentAccess(db, enrollmentId, settings?.post_bootcamp_access_months ?? 3);
}

async function applyAmountToInstallments(
  db: SupabaseClient,
  enrollmentId: string,
  amount: number,
): Promise<void> {
  const { data: installments, error } = await db
    .from('payment_installments')
    .select('id, amount_due, amount_paid')
    .eq('enrollment_id', enrollmentId)
    .order('due_date', { ascending: true });
  if (error) throw error;

  let remaining = amount;
  for (const inst of installments ?? []) {
    if (remaining <= 0) break;
    const owed = Number(inst.amount_due) - Number(inst.amount_paid);
    if (owed <= 0) continue;
    const applying = Math.min(remaining, owed);
    const newPaid = Number(inst.amount_paid) + applying;
    const { error: updErr } = await db
      .from('payment_installments')
      .update({
        amount_paid: newPaid,
        status: newPaid >= Number(inst.amount_due) ? 'paid' : 'partial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inst.id);
    if (updErr) throw updErr;
    remaining -= applying;
  }
}

export async function recomputeEnrollmentAccessPublic(
  db: SupabaseClient,
  enrollmentId: string,
  postBootcampAccessMonths = 3,
): Promise<void> {
  return recomputeEnrollmentAccess(db, enrollmentId, postBootcampAccessMonths);
}

async function recomputeEnrollmentAccess(
  db: SupabaseClient,
  enrollmentId: string,
  postBootcampAccessMonths = 3,
): Promise<void> {
  const { data: enroll, error } = await db
    .from('bootcamp_enrollments')
    .select('total_fee, deposit_required, paid_total, payment_plan, bootcamp_ends_at')
    .eq('id', enrollmentId)
    .single();
  if (error || !enroll) throw error ?? new Error('Enrollment not found');

  const { data: installments, error: instErr } = await db
    .from('payment_installments')
    .select('due_date, status')
    .eq('enrollment_id', enrollmentId);
  if (instErr) throw instErr;

  const access = computeAccess({
    payment_plan: enroll.payment_plan as any,
    total_fee: Number(enroll.total_fee),
    deposit_required: Number(enroll.deposit_required),
    paid_total: Number(enroll.paid_total),
    bootcamp_ends_at: enroll.bootcamp_ends_at ? new Date(enroll.bootcamp_ends_at) : null,
    post_bootcamp_access_months: postBootcampAccessMonths,
    installments: (installments ?? []).map((i: any) => ({ due_date: new Date(i.due_date), status: i.status })),
  });

  const { error: accessUpdErr } = await db
    .from('bootcamp_enrollments')
    .update({
      access_status: access.access_status,
      access_until: access.access_until ? access.access_until.toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
  if (accessUpdErr) throw accessUpdErr;
}
