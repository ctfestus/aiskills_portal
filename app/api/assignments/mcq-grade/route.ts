import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { parseSubmissionRecord, gradeMcq } from '@/lib/assignment-scenarios';

// Returns server-computed MCQ correctness + suggested subtotal for a scenario submission, to any
// authorized grader (instructor/admin/staff) -- WITHOUT returning the answer keys. This lets a
// non-owning instructor grade correctly (the answer-key table is owner/admin-only), while the
// keys themselves never reach the browser.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authRes = await requireUser(req);
  if (isAuthError(authRes)) return authRes.error;
  const { user } = authRes;

  const submissionId = req.nextUrl.searchParams.get('submissionId');
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 });

  const supabase = adminClient();

  const { data: me } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!me || !['admin', 'instructor', 'staff'].includes(me.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data: sub } = await supabase.from('assignment_submissions')
    .select('id, assignment_id, response_text').eq('id', submissionId).single();
  if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  const record = parseSubmissionRecord(sub.response_text);
  if (!record) return NextResponse.json({ grades: {}, subtotal: null });

  const { data: keyRow } = await supabase.from('assignment_answer_keys')
    .select('keys').eq('assignment_id', sub.assignment_id).maybeSingle();
  const { grades, subtotal } = gradeMcq(record, (keyRow?.keys ?? {}) as Record<string, string>);
  return NextResponse.json({ grades, subtotal });
}
