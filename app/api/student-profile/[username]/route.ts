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

  // 3. Certificates (by student_id, non-revoked) -- use course_id (migrated from form_id)
  const { data: certsRaw } = await supabase
    .from('certificates')
    .select('id, course_id, student_name, issued_at')
    .eq('student_id', student.id)
    .eq('revoked', false)
    .order('issued_at', { ascending: false });

  // 4. Fetch content metadata for certificates from courses and virtual_experiences
  const certContentIds = [...new Set((certsRaw ?? []).map((c: any) => c.course_id).filter(Boolean))];

  const [{ data: coursesRaw }, { data: vesRaw }] = certContentIds.length
    ? await Promise.all([
        supabase.from('courses').select('id, title, cover_image').in('id', certContentIds),
        supabase.from('virtual_experiences').select('id, title, cover_image').in('id', certContentIds),
      ])
    : [{ data: [] }, { data: [] }];

  const contentMap: Record<string, any> = {};
  for (const c of coursesRaw ?? []) contentMap[c.id] = { ...c, content_type: 'course' };
  for (const v of vesRaw     ?? []) contentMap[v.id] = { ...v, content_type: 'virtual_experience' };

  const allCerts = (certsRaw ?? []).map((c: any) => ({
    id:          c.id,
    studentName: c.student_name,
    courseName:  contentMap[c.course_id]?.title || 'Course',
    coverImage:  contentMap[c.course_id]?.cover_image ?? null,
    contentType: contentMap[c.course_id]?.content_type ?? 'course',
    issuedAt:    c.issued_at,
  }));

  const certificates    = allCerts.filter((c: any) => c.contentType !== 'virtual_experience');
  const virtualExpCerts = allCerts.filter((c: any) => c.contentType === 'virtual_experience');

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
  });
}
