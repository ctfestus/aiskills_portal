import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { SOLUTION_BUCKET } from '@/lib/assignment-solutions';
import { passMarkOf } from '@/lib/assignment-scenarios';

// GET /api/assignments/solution-file?id=<assignment_solutions.id>
//
// The only way to read a solution file. The bucket is private and has no storage policy, so the
// object is unreachable without this route. Release is re-checked here with the service role
// rather than trusted from RLS alone: a grader may always read it, a student only once their own
// submission -- or their group's -- is graded. Returns a 60s signed URL that downloads under the
// original file name; the caller navigates to it (auth here is Bearer, so a plain anchor cannot
// hit this route directly).
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL = 60; // seconds

export async function GET(req: NextRequest) {
  const authRes = await requireUser(req);
  if (isAuthError(authRes)) return authRes.error;
  const { user } = authRes;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = adminClient();

  const { data: solution } = await supabase.from('assignment_solutions')
    .select('id, assignment_id, name, kind, storage_path').eq('id', id).maybeSingle();
  if (!solution) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (solution.kind !== 'file' || !solution.storage_path) {
    return NextResponse.json({ error: 'This solution is a link, not a file.' }, { status: 400 });
  }

  const { data: me } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isGrader = !!me && ['admin', 'instructor', 'staff'].includes(me.role);

  if (!isGrader) {
    // Release only once the student's work is FINAL: graded AND at/above this assignment's passing
    // score (a failing grade can still be reset to draft and resubmitted, so releasing then would
    // hand over the model answer mid-attempt). The pass mark is the assignment's configured value,
    // defaulting to DEFAULT_PASS_MARK -- the same rule the RLS release policy applies.
    const { data: assignment } = await supabase.from('assignments')
      .select('config').eq('id', solution.assignment_id).maybeSingle();
    const passMark = passMarkOf(assignment?.config);

    // Released to this student? Their own graded+passed submission, or a group submission they were
    // actually part of. Mirrors the "assignment_solutions: released select" RLS policy.
    const { data: groupRows } = await supabase.from('group_members')
      .select('group_id').eq('student_id', user.id);
    const groupIds = (groupRows ?? []).map(r => r.group_id).filter(Boolean);

    const { data: own } = await supabase.from('assignment_submissions')
      .select('id').eq('assignment_id', solution.assignment_id).eq('student_id', user.id)
      .eq('status', 'graded').gte('score', passMark).limit(1);

    let released = (own ?? []).length > 0;
    if (!released && groupIds.length > 0) {
      // Only a group submission that includes this student (they are one of its participants).
      const { data: group } = await supabase.from('assignment_submissions')
        .select('id').eq('assignment_id', solution.assignment_id).in('group_id', groupIds)
        .eq('status', 'graded').gte('score', passMark).contains('participants', [user.id]).limit(1);
      released = (group ?? []).length > 0;
    }
    if (!released) {
      return NextResponse.json({ error: 'The solution is released once your submission passes.' }, { status: 403 });
    }
  }

  // The download name ends up in the object's Content-Disposition, so keep it to plain filename
  // characters rather than passing instructor-typed text straight through.
  const downloadName = (solution.name || '').replace(/[^a-zA-Z0-9._ -]/g, '_').trim();

  const { data: signed, error } = await supabase.storage.from(SOLUTION_BUCKET)
    .createSignedUrl(solution.storage_path, SIGNED_URL_TTL, { download: downloadName || true });
  if (error || !signed?.signedUrl) {
    console.error('[solution-file]', error);
    return NextResponse.json({ error: 'Could not prepare the download.' }, { status: 502 });
  }

  return NextResponse.json({ url: signed.signedUrl, name: solution.name }, { headers: { 'Cache-Control': 'no-store' } });
}
