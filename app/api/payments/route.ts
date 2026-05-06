import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getEnrollmentRows,
  recordPayment,
  markOutstanding,
  restoreAccess,
  getPaymentHistory,
  editPayment,
  deletePayment,
  recomputeEnrollmentAccessPublic,
} from '@/lib/db-payments';

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
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user?.email) return null;

  const { data: student } = await adminClient()
    .from('students')
    .select('role')
    .eq('id', user.id)
    .single();

  return { id: user.id, email: user.email.trim().toLowerCase(), role: student?.role ?? 'student' };
}

// -- GET --

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  if (action === 'installments') {
    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId');
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      const db = adminClient();
      const { data, error } = await db
        .from('payment_installments')
        .select('id, due_date, amount_due, amount_paid, status')
        .eq('enrollment_id', enrollmentId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ installments: data ?? [] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to load installments' }, { status: 500 });
    }
  }

  if (action === 'history') {
    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId');
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      const db = adminClient();
      const payments = await getPaymentHistory(db, enrollmentId);
      return NextResponse.json({ payments });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to load payment history' }, { status: 500 });
    }
  }

  if (action === 'summary') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      const db = adminClient();
      const { rows, cohorts } = await getEnrollmentRows(db);
      return NextResponse.json({ rows, cohorts });
    } catch (err: any) {
      console.error('[payments/summary]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to load payment data' }, { status: 500 });
    }
  }

  if (action === 'confirmations') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      const db = adminClient();
      const { data, error } = await db
        .from('student_payment_confirmations')
        .select(`
          id, amount, paid_at, method, reference, notes, receipt_url,
          status, admin_notes, reviewed_at, created_at,
          enrollment_id, cohort_id,
          students!student_id ( full_name, email ),
          cohorts ( name )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ confirmations: data ?? [] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to load confirmations' }, { status: 500 });
    }
  }

  if (action === 'payment-options') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      const db = adminClient();
      const { data, error } = await db
        .from('payment_options')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ options: data ?? [] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to load payment options' }, { status: 500 });
    }
  }

  if (action === 'payment-config') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      const db = adminClient();
      const { data, error } = await db
        .from('payment_config')
        .select('outstanding_cohort_id')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ config: data ?? {} });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to load payment config' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// -- POST --

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

  const db = adminClient();

  // record-payment -- insert payment, apply to installments, recompute access
  if (body.action === 'record-payment') {
    const { enrollmentId, amount, paidAt, method, reference, notes } = body;
    if (!enrollmentId || !amount) {
      return NextResponse.json({ error: 'enrollmentId and amount are required' }, { status: 400 });
    }
    try {
      const { data: enroll } = await db
        .from('bootcamp_enrollments')
        .select('student_id, cohort_id, email')
        .eq('id', enrollmentId)
        .single();
      if (!enroll) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

      await recordPayment(db, {
        enrollmentId,
        amount:      Number(amount),
        paidAt,
        method,
        reference,
        notes,
        payerEmail:  enroll.email,
        cohortId:    enroll.cohort_id,
        studentId:   enroll.student_id ?? undefined,
      });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/record-payment]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to record payment' }, { status: 500 });
    }
  }

  // edit-enrollment -- update fee, plan; recompute access
  // Bootcamp dates are cohort-level and updated via save-settings, not here.
  if (body.action === 'edit-enrollment') {
    const { enrollmentId, total_fee, deposit_required, payment_plan } = body;
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (total_fee        !== undefined) updates.total_fee        = Number(total_fee);
      if (deposit_required !== undefined) updates.deposit_required = Number(deposit_required);
      if (payment_plan     !== undefined) updates.payment_plan     = payment_plan;

      await db.from('bootcamp_enrollments').update(updates).eq('id', enrollmentId);

      const { data: enroll } = await db
        .from('bootcamp_enrollments')
        .select('cohort_id')
        .eq('id', enrollmentId)
        .single();
      const { data: settings } = await db
        .from('cohort_payment_settings')
        .select('post_bootcamp_access_months')
        .eq('cohort_id', enroll!.cohort_id)
        .maybeSingle();

      await recomputeEnrollmentAccessPublic(db, enrollmentId, settings?.post_bootcamp_access_months ?? 3);

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/edit-enrollment]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to update enrollment' }, { status: 500 });
    }
  }

  // mark-waived -- set payment_plan to waived, recompute access + auto-restore cohort
  if (body.action === 'mark-waived') {
    const { enrollmentId } = body;
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    try {
      const { data: enroll } = await db
        .from('bootcamp_enrollments')
        .select('cohort_id, student_id')
        .eq('id', enrollmentId)
        .single();
      if (!enroll) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

      await db.from('bootcamp_enrollments').update({
        payment_plan: 'waived',
        updated_at:   new Date().toISOString(),
      }).eq('id', enrollmentId);

      // Set payment_exempt so waived students are never auto-moved to outstanding
      if (enroll.student_id) {
        await db.from('students').update({ payment_exempt: true }).eq('id', enroll.student_id);
      }

      const { data: settings } = await db
        .from('cohort_payment_settings')
        .select('post_bootcamp_access_months')
        .eq('cohort_id', enroll.cohort_id)
        .maybeSingle();

      // recomputeEnrollmentAccessPublic computes access_status='waived' and
      // auto-restores cohort via getOutstandingCohortAction
      await recomputeEnrollmentAccessPublic(db, enrollmentId, settings?.post_bootcamp_access_months ?? 3);

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/mark-waived]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to mark waived' }, { status: 500 });
    }
  }

  // move-to-outstanding -- move student to outstanding cohort, save original_cohort_id
  if (body.action === 'move-to-outstanding') {
    const { studentId, outstandingCohortId } = body;
    if (!studentId || !outstandingCohortId) {
      return NextResponse.json({ error: 'studentId and outstandingCohortId are required' }, { status: 400 });
    }
    try {
      const result = await markOutstanding(db, studentId, outstandingCohortId);
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      console.error('[payments/move-to-outstanding]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to move student' }, { status: 500 });
    }
  }

  // restore-cohort -- move student back to original cohort
  if (body.action === 'restore-cohort') {
    const { studentId } = body;
    if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    try {
      await restoreAccess(db, studentId);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/restore-cohort]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to restore cohort' }, { status: 500 });
    }
  }

  // toggle-exempt -- grant or revoke payment exemption
  if (body.action === 'toggle-exempt') {
    const { studentId, exempt } = body;
    if (!studentId || typeof exempt !== 'boolean') {
      return NextResponse.json({ error: 'studentId and exempt (boolean) are required' }, { status: 400 });
    }
    try {
      await db.from('students').update({ payment_exempt: exempt }).eq('id', studentId);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to update exemption' }, { status: 500 });
    }
  }

  // edit-installment -- update a single installment's due_date
  if (body.action === 'edit-installment') {
    const { installmentId, due_date } = body;
    if (!installmentId || !due_date) {
      return NextResponse.json({ error: 'installmentId and due_date are required' }, { status: 400 });
    }
    try {
      const { error } = await db
        .from('payment_installments')
        .update({ due_date, updated_at: new Date().toISOString() })
        .eq('id', installmentId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to update installment' }, { status: 500 });
    }
  }

  // edit-payment -- update amount/date/method/reference/notes, recompute paid_total + access
  if (body.action === 'edit-payment') {
    const { paymentId, amount, paidAt, method, reference, notes } = body;
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    try {
      await editPayment(db, paymentId, {
        ...(amount    !== undefined && { amount: Number(amount) }),
        ...(paidAt    !== undefined && { paid_at: paidAt }),
        ...(method    !== undefined && { method:    method    ?? null }),
        ...(reference !== undefined && { reference: reference ?? null }),
        ...(notes     !== undefined && { notes:     notes     ?? null }),
      });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/edit-payment]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to edit payment' }, { status: 500 });
    }
  }

  // delete-payment -- remove record, recompute paid_total + access
  if (body.action === 'delete-payment') {
    const { paymentId } = body;
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    try {
      await deletePayment(db, paymentId);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/delete-payment]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to delete payment' }, { status: 500 });
    }
  }

  // approve-confirmation -- approve student payment confirmation and record the payment
  if (body.action === 'approve-confirmation') {
    const { confirmationId, adminNotes } = body;
    if (!confirmationId) return NextResponse.json({ error: 'confirmationId is required' }, { status: 400 });
    try {
      // Step 1: Atomically claim the confirmation by flipping pending -> approved.
      // The .eq('status','pending') guard means only one concurrent request can win;
      // any duplicate or retry gets 0 rows back and is rejected before touching payments.
      const { data: conf, error: claimErr } = await db
        .from('student_payment_confirmations')
        .update({
          status:      'approved',
          reviewed_by: sessionUser.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes ?? null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', confirmationId)
        .eq('status', 'pending')
        .select('id, enrollment_id, student_id, cohort_id, amount, paid_at, method, reference, notes')
        .single();

      if (claimErr || !conf) {
        return NextResponse.json({ error: 'Confirmation not found or already processed' }, { status: 409 });
      }

      // Step 2: Record the payment. If this fails, roll back the confirmation to
      // pending so an admin can retry without needing manual DB intervention.
      try {
        const { data: enroll } = await db
          .from('bootcamp_enrollments')
          .select('email')
          .eq('id', conf.enrollment_id)
          .single();
        if (!enroll) throw new Error('Enrollment not found');

        await recordPayment(db, {
          enrollmentId:   conf.enrollment_id,
          amount:         Number(conf.amount),
          paidAt:         conf.paid_at,
          method:         conf.method ?? undefined,
          reference:      conf.reference ?? undefined,
          notes:          conf.notes ?? undefined,
          payerEmail:     enroll.email,
          cohortId:       conf.cohort_id,
          studentId:      conf.student_id ?? undefined,
          confirmationId: conf.id,
        });
      } catch (payErr: any) {
        // Roll back so the confirmation can be retried
        await db
          .from('student_payment_confirmations')
          .update({ status: 'pending', reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
          .eq('id', confirmationId);
        throw payErr;
      }

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/approve-confirmation]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to approve confirmation' }, { status: 500 });
    }
  }

  // reject-confirmation -- reject student payment confirmation
  if (body.action === 'reject-confirmation') {
    const { confirmationId, adminNotes } = body;
    if (!confirmationId) return NextResponse.json({ error: 'confirmationId is required' }, { status: 400 });
    try {
      const { data: conf, error: confErr } = await db
        .from('student_payment_confirmations')
        .select('id, status')
        .eq('id', confirmationId)
        .single();
      if (confErr || !conf) return NextResponse.json({ error: 'Confirmation not found' }, { status: 404 });
      if (conf.status !== 'pending') {
        return NextResponse.json({ error: 'Confirmation is not pending' }, { status: 409 });
      }

      const { error: updErr } = await db
        .from('student_payment_confirmations')
        .update({
          status:      'rejected',
          reviewed_by: sessionUser.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes ?? null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', confirmationId);
      if (updErr) throw updErr;

      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/reject-confirmation]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to reject confirmation' }, { status: 500 });
    }
  }

  // save-payment-config -- upsert global payment behaviour settings
  if (body.action === 'save-payment-config') {
    const { outstandingCohortId } = body;
    try {
      const { error } = await db.from('payment_config').upsert({
        id:                    'default',
        outstanding_cohort_id: outstandingCohortId || null,
        updated_at:            new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/save-payment-config]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to save payment config' }, { status: 500 });
    }
  }

  // save-payment-option -- create or update a global payment option
  if (body.action === 'save-payment-option') {
    const {
      id, label, type, instructions,
      bank_name, account_name, account_number, branch, country,
      mobile_money_number, network,
      payment_link, platform,
      logo_url, is_active, sort_order,
    } = body;
    if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });
    try {
      const payload: any = {
        label,
        type:                type ?? 'bank_transfer',
        instructions:        instructions ?? null,
        bank_name:           bank_name ?? null,
        account_name:        account_name ?? null,
        account_number:      account_number ?? null,
        branch:              branch ?? null,
        country:             country ?? null,
        mobile_money_number: mobile_money_number ?? null,
        network:             network ?? null,
        payment_link:        payment_link ?? null,
        platform:            platform ?? null,
        logo_url:            logo_url ?? null,
        is_active:           typeof is_active === 'boolean' ? is_active : true,
        sort_order:          typeof sort_order === 'number' ? sort_order : 0,
        updated_at:          new Date().toISOString(),
      };
      if (id) {
        const { error } = await db.from('payment_options').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db.from('payment_options').insert(payload);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/save-payment-option]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to save payment option' }, { status: 500 });
    }
  }

  // delete-payment-option -- remove a global payment option
  if (body.action === 'delete-payment-option') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    try {
      const { error } = await db.from('payment_options').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/delete-payment-option]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to delete payment option' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
