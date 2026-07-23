import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { suggestGrade, type SubmissionForGrading } from '@/lib/assignment-grading';

export const dynamic = 'force-dynamic';

// Ceiling per call so a huge cohort never runs unbounded. Surfaced in the response
// (counts.capped) so the caller knows to run again rather than assuming full coverage.
const MAX_SUBMISSIONS = 200;

// POST /api/assignments/bulk-grade
// Body: { assignmentId, submissionIds?: string[], apply?: boolean }
// Default (apply not true) previews suggested grades without writing anything.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;
  const db = auth.supabase;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const assignmentId: string | undefined = body.assignmentId;
  const submissionIds: string[] | undefined =
    Array.isArray(body.submissionIds) ? body.submissionIds.filter((x: unknown) => typeof x === 'string') : undefined;
  const apply = body.apply === true;

  if (!assignmentId) {
    return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
  }

  const { data: assignment, error: aErr } = await db
    .from('assignments')
    .select('id, title, type')
    .eq('id', assignmentId)
    .maybeSingle();
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  // Submitted submissions only. Explicit ids override the "ungraded" filter so a caller can
  // re-preview specific rows; otherwise we default to everything not yet graded.
  // The students embed disambiguates the two FKs (student_id, submitted_by) with !student_id.
  let query = db
    .from('assignment_submissions')
    .select('id, status, response_text, student:students!student_id(full_name, email)')
    .eq('assignment_id', assignmentId)
    .not('submitted_at', 'is', null);
  if (submissionIds?.length) query = query.in('id', submissionIds);
  else query = query.is('graded_at', null);
  query = query.order('submitted_at', { ascending: true }).limit(MAX_SUBMISSIONS + 1);

  const { data: rows, error: sErr } = await query;
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const all = (rows ?? []) as any[];
  const capped = all.length > MAX_SUBMISSIONS;
  const subs = capped ? all.slice(0, MAX_SUBMISSIONS) : all;

  const suggestions = subs.map((s) => suggestGrade({
    id:            s.id,
    status:        s.status,
    response_text: s.response_text,
    student:       Array.isArray(s.student) ? s.student[0] : s.student,
  } as SubmissionForGrading));

  let applied = 0;
  if (apply) {
    const gradable = suggestions.filter((x) => x.suggestedScore != null);
    const results = await Promise.all(gradable.map(async (g) => {
      // .is('graded_at', null) makes this idempotent and stops us overwriting a human grade.
      const { data, error } = await db
        .from('assignment_submissions')
        .update({
          score:     g.suggestedScore,
          feedback:  g.feedback,
          status:    'graded',
          graded_by: auth.user.id,
          graded_at: new Date().toISOString(),
        })
        .eq('id', g.submissionId)
        .is('graded_at', null)
        .select('id');
      return !error && Array.isArray(data) && data.length > 0;
    }));
    applied = results.filter(Boolean).length;
  }

  return NextResponse.json({
    assignment: { id: assignment.id, title: assignment.title, type: assignment.type },
    counts: {
      total:      suggestions.length,
      autoScored: suggestions.filter((s) => s.source === 'ai-review').length,
      manual:     suggestions.filter((s) => s.source === 'manual').length,
      applied,
      capped:     capped ? MAX_SUBMISSIONS : 0,
    },
    suggestions,
  });
}
