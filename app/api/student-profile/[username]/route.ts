import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client -- bypasses RLS. Used only server-side.
// Returns only safe, non-sensitive fields in the response (no email, no status).
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  if (!username) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = adminClient();

  // 1. Look up student by username (case-insensitive)
  const { data: student, error } = await supabase
    .from('students')
    .select('id, email, full_name, avatar_url, bio, country, city, social_links, role, cohort_id, created_at, username, education, work_experience')
    .ilike('username', username)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. Certificates (by student_id, non-revoked)
  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('id, form_id, student_name, issued_at')
    .eq('student_id', student.id)
    .eq('revoked', false)
    .order('issued_at', { ascending: false });

  // 3. Completed course attempts (passed)
  const { data: attemptsRaw } = await supabase
    .from('course_attempts')
    .select('form_id, score, points, completed_at')
    .eq('student_email', student.email)
    .eq('passed', true)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  // Deduplicate -- keep the best attempt per course
  const bestAttemptMap: Record<string, any> = {};
  for (const a of attemptsRaw ?? []) {
    const prev = bestAttemptMap[a.form_id];
    if (!prev || a.score > prev.score) bestAttemptMap[a.form_id] = a;
  }
  const completedAttempts = Object.values(bestAttemptMap);

  // 4. Fetch form titles for certs + completions
  const allFormIds = [
    ...new Set([
      ...(certsRaw ?? []).map((c: any) => c.form_id),
      ...completedAttempts.map((a: any) => a.form_id),
    ]),
  ];
  const { data: formsRaw } = allFormIds.length
    ? await supabase
        .from('forms')
        .select('id, title, config')
        .in('id', allFormIds)
    : { data: [] };

  const formMap: Record<string, any> = {};
  for (const f of formsRaw ?? []) formMap[f.id] = f;

  const certificates = (certsRaw ?? []).map((c: any) => ({
    id:          c.id,
    studentName: c.student_name,
    courseName:  formMap[c.form_id]?.config?.title || formMap[c.form_id]?.title || 'Course',
    coverImage:  formMap[c.form_id]?.config?.coverImage ?? null,
    issuedAt:    c.issued_at,
  }));

  const completedCourses = completedAttempts.map((a: any) => ({
    formId:      a.form_id,
    courseName:  formMap[a.form_id]?.config?.title || formMap[a.form_id]?.title || 'Course',
    coverImage:  formMap[a.form_id]?.config?.coverImage ?? null,
    score:       a.score,
    completedAt: a.completed_at,
  }));

  // 5. Leaderboard rank within cohort (by total XP)
  let leaderboardRank: number | null = null;
  let cohortSize = 0;
  let myXp = 0;

  if (student.cohort_id) {
    // Get all student emails in the same cohort
    const { data: cohortStudents } = await supabase
      .from('students')
      .select('email')
      .eq('cohort_id', student.cohort_id)
      .eq('role', 'student')
      .eq('status', 'active');

    const emails = (cohortStudents ?? []).map((s: any) => s.email);
    cohortSize = emails.length;

    if (emails.length > 0) {
      const { data: xpRows } = await supabase
        .from('student_xp')
        .select('student_email, total_xp')
        .in('student_email', emails);

      const xpMap: Record<string, number> = {};
      for (const x of xpRows ?? []) xpMap[x.student_email] = x.total_xp;

      myXp = xpMap[student.email] ?? 0;

      // Rank = number of students with strictly more XP + 1
      leaderboardRank =
        emails.filter((e: string) => (xpMap[e] ?? 0) > myXp).length + 1;
    }
  }

  // 6. Build response -- never include email, status, cohort_id
  return NextResponse.json({
    profile: {
      username:       student.username,
      fullName:       student.full_name,
      avatarUrl:      student.avatar_url,
      bio:            student.bio,
      country:        student.country,
      city:           student.city,
      socialLinks:    student.social_links ?? {},
      role:           student.role,
      memberSince:    student.created_at,
      education:      student.education ?? [],
      workExperience: student.work_experience ?? [],
    },
    stats: {
      coursesCompleted: completedCourses.length,
      certificates:     certificates.length,
      xp:               myXp,
      leaderboardRank,
      cohortSize,
    },
    certificates,
    completedCourses,
  });
}
