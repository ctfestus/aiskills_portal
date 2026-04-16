import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // 1. Look up student -- stable core columns only
  const { data: student, error } = await supabase
    .from('students')
    .select('id, email, full_name, avatar_url, bio, country, city, social_links, role, cohort_id, created_at, username')
    .ilike('username', username)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. Optional JSONB columns (gracefully default if migrations not run yet)
  const { data: extra } = await supabase
    .from('students')
    .select('education, work_experience, skills')
    .eq('id', student.id)
    .maybeSingle();

  const education       = extra?.education       ?? [];
  const work_experience = extra?.work_experience ?? [];
  const skills          = extra?.skills          ?? [];

  // 3. Certificates (by student_id, non-revoked)
  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('id, course_id, ve_id, learning_path_id, student_name, issued_at')
    .eq('student_id', student.id)
    .eq('revoked', false)
    .order('issued_at', { ascending: false });

  // 4. Fetch content metadata from each relevant table
  const courseIds = [...new Set((certsRaw ?? []).map((c: any) => c.course_id).filter(Boolean))];
  const veIds     = [...new Set((certsRaw ?? []).map((c: any) => c.ve_id).filter(Boolean))];
  const pathIds   = [...new Set((certsRaw ?? []).map((c: any) => c.learning_path_id).filter(Boolean))];

  const [{ data: coursesRaw }, { data: vesRaw }, { data: pathsRaw }] = await Promise.all([
    courseIds.length ? supabase.from('courses').select('id, title, cover_image').in('id', courseIds) : Promise.resolve({ data: [] }),
    veIds.length     ? supabase.from('virtual_experiences').select('id, title, cover_image').in('id', veIds) : Promise.resolve({ data: [] }),
    pathIds.length   ? supabase.from('learning_paths').select('id, title').in('id', pathIds) : Promise.resolve({ data: [] }),
  ]);

  const courseMap: Record<string, any> = Object.fromEntries((coursesRaw ?? []).map((r: any) => [r.id, r]));
  const veMap:     Record<string, any> = Object.fromEntries((vesRaw     ?? []).map((r: any) => [r.id, r]));
  const pathMap:   Record<string, any> = Object.fromEntries((pathsRaw   ?? []).map((r: any) => [r.id, r]));

  const allCerts = (certsRaw ?? []).map((c: any) => {
    const isCourse = !!c.course_id;
    const isVE     = !!c.ve_id;
    const isPath   = !!c.learning_path_id;
    const content  = isCourse ? courseMap[c.course_id] : isVE ? veMap[c.ve_id] : isPath ? pathMap[c.learning_path_id] : null;
    const contentType = isCourse ? 'course' : isVE ? 'virtual_experience' : isPath ? 'learning_path' : 'course';
    return {
      id:          c.id,
      studentName: c.student_name,
      courseName:  content?.title || (isVE ? 'Virtual Experience' : isPath ? 'Learning Path' : 'Course'),
      coverImage:  content?.cover_image ?? null,
      contentType,
      issuedAt:    c.issued_at,
    };
  });

  const certificates    = allCerts.filter((c: any) => c.contentType === 'course');
  const virtualExpCerts = allCerts.filter((c: any) => c.contentType === 'virtual_experience');
  const pathCerts       = allCerts.filter((c: any) => c.contentType === 'learning_path');

  // 5. Leaderboard rank within cohort
  let leaderboardRank: number | null = null;
  let cohortSize = 0;
  let myXp = 0;

  if (student.cohort_id) {
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
      leaderboardRank = emails.filter((e: string) => (xpMap[e] ?? 0) > myXp).length + 1;
    }
  }

  // 6. Build response -- never expose email, status, cohort_id
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
      education,
      workExperience: work_experience,
      skills,
    },
    certificates,
    virtualExpCerts,
    pathCerts,
  });
}
