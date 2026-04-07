import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getPaymentRows,
  invalidatePaymentCache,
  updatePaymentRow,
  getSheetUrl,
} from '@/lib/sheets';

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

// -- GET ---

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  // summary -- returns sheet rows enriched with each student's current cohort info
  if (action === 'summary') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['instructor', 'admin'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      const [rows, cohortsRes, studentsRes] = await Promise.all([
        getPaymentRows(),
        adminClient().from('cohorts').select('id, name').order('name'),
        adminClient().from('students').select('id, email, cohort_id, original_cohort_id, payment_exempt'),
      ]);

      const sheetUrl = getSheetUrl();

      // Build email student map for quick lookup
      const studentMap: Record<string, any> = {};
      for (const s of studentsRes.data ?? []) {
        studentMap[s.email.toLowerCase().trim()] = s;
      }

      // Build cohort id name map
      const cohortMap: Record<string, string> = {};
      for (const c of cohortsRes.data ?? []) cohortMap[c.id] = c.name;

      // Enrich each sheet row with cohort info
      const enriched = rows.map(r => {
        const student = studentMap[r.email] ?? null;
        return {
          ...r,
          student_id:            student?.id ?? null,
          current_cohort_id:     student?.cohort_id ?? null,
          current_cohort_name:   student?.cohort_id ? (cohortMap[student.cohort_id] ?? 'Unknown') : 'No cohort',
          original_cohort_id:    student?.original_cohort_id ?? null,
          original_cohort_name:  student?.original_cohort_id ? (cohortMap[student.original_cohort_id] ?? 'Unknown') : null,
          payment_exempt:        student?.payment_exempt ?? false,
        };
      });

      return NextResponse.json({ rows: enriched, cohorts: cohortsRes.data ?? [], sheetUrl });
    } catch (err: any) {
      console.error('[payments/summary]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to load payment data' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// -- POST ---

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

  // refresh -- invalidate Redis cache
  if (body.action === 'refresh') {
    try {
      await invalidatePaymentCache();
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Cache invalidation failed' }, { status: 500 });
    }
  }

  // update-row -- update sheet fields (amount_paid, billing_month, etc.)
  if (body.action === 'update-row') {
    const { email, billing_month, amount_due, amount_paid, notes } = body;
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
    try {
      await updatePaymentRow(email, {
        ...(billing_month !== undefined && { billing_month }),
        ...(amount_due    !== undefined && { amount_due: Number(amount_due) }),
        ...(amount_paid   !== undefined && { amount_paid: Number(amount_paid) }),
        ...(notes         !== undefined && { notes }),
      });
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to update row' }, { status: 500 });
    }
  }

  // new-month -- reset all students' amount_paid and billing_month in sheet
  if (body.action === 'new-month') {
    const { billing_month, amount_due } = body;
    if (!billing_month) return NextResponse.json({ error: 'billing_month is required' }, { status: 400 });
    try {
      const rows = await getPaymentRows();
      await Promise.all(rows.map(r =>
        updatePaymentRow(r.email, {
          billing_month,
          amount_paid: 0,
          ...(amount_due !== undefined && { amount_due: Number(amount_due) }),
        })
      ));
      return NextResponse.json({ ok: true, updated: rows.length });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to reset month' }, { status: 500 });
    }
  }

  // move-to-outstanding -- move student to the outstanding cohort, save their original cohort
  if (body.action === 'move-to-outstanding') {
    const { studentId, outstandingCohortId } = body;
    if (!studentId || !outstandingCohortId) {
      return NextResponse.json({ error: 'studentId and outstandingCohortId are required' }, { status: 400 });
    }
    try {
      // Fetch current cohort before moving
      const { data: student, error: fetchErr } = await adminClient()
        .from('students')
        .select('cohort_id, original_cohort_id')
        .eq('id', studentId)
        .single();

      if (fetchErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

      // If already in the outstanding cohort, nothing to do
      if (student.cohort_id === outstandingCohortId) return NextResponse.json({ ok: true, alreadyMoved: true });

      const { error: updateErr } = await adminClient()
        .from('students')
        .update({
          original_cohort_id: student.cohort_id, // save where they came from
          cohort_id:          outstandingCohortId,
        })
        .eq('id', studentId);

      if (updateErr) throw updateErr;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/move-to-outstanding]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to move student' }, { status: 500 });
    }
  }

  // restore-cohort -- move student back to their original cohort
  if (body.action === 'restore-cohort') {
    const { studentId } = body;
    if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    try {
      const { data: student, error: fetchErr } = await adminClient()
        .from('students')
        .select('original_cohort_id')
        .eq('id', studentId)
        .single();

      if (fetchErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      if (!student.original_cohort_id) {
        return NextResponse.json({ error: 'No original cohort saved for this student' }, { status: 400 });
      }

      const { error: updateErr } = await adminClient()
        .from('students')
        .update({
          cohort_id:          student.original_cohort_id,
          original_cohort_id: null,  // clear after restore
          payment_exempt:     true,  // auto-exempt so auto-sync won't move them back
        })
        .eq('id', studentId);

      if (updateErr) throw updateErr;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[payments/restore-cohort]', err);
      return NextResponse.json({ error: err.message ?? 'Failed to restore cohort' }, { status: 500 });
    }
  }

  // toggle-exempt -- grant or revoke payment exemption for a student
  if (body.action === 'toggle-exempt') {
    const { studentId, exempt } = body;
    if (!studentId || typeof exempt !== 'boolean') {
      return NextResponse.json({ error: 'studentId and exempt (boolean) are required' }, { status: 400 });
    }
    try {
      const { error: updateErr } = await adminClient()
        .from('students')
        .update({ payment_exempt: exempt })
        .eq('id', studentId);
      if (updateErr) throw updateErr;
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to update exemption' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
