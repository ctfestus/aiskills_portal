/**
 * POST /api/assignments/resubmit
 * Resets a failed graded submission back to draft so the student can resubmit.
 * Uses the admin client so student RLS is not widened.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

const PASS_MARK = 85;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { submissionId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { submissionId } = body;
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 });

  const db = adminClient();

  // Fetch the submission
  const { data: submission, error: fetchErr } = await db
    .from('assignment_submissions')
    .select('id, student_id, group_id, status, score')
    .eq('id', submissionId)
    .maybeSingle();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Must be the original submitter, or the current leader of a group submission
  if (submission.student_id !== user.id) {
    if (submission.group_id) {
      const { data: membership } = await db
        .from('group_members')
        .select('is_leader')
        .eq('group_id', submission.group_id)
        .eq('student_id', user.id)
        .maybeSingle();
      if (!membership?.is_leader) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Must be graded and failed
  if (submission.status !== 'graded') {
    return NextResponse.json({ error: 'Submission is not graded' }, { status: 400 });
  }
  if (submission.score !== null && submission.score >= PASS_MARK) {
    return NextResponse.json({ error: 'Submission already passed' }, { status: 400 });
  }

  // Reset -- admin client bypasses RLS so student RLS stays strict
  const { error: updateErr } = await db
    .from('assignment_submissions')
    .update({
      status:     'draft',
      score:      null,
      feedback:   null,
      graded_by:  null,
      graded_at:  null,
    })
    .eq('id', submissionId);

  if (updateErr) {
    console.error('[resubmit]', updateErr);
    return NextResponse.json({ error: 'Failed to reset submission' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
