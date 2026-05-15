import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function getStaffUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { cohort_id, group_size, name_prefix = 'Group', shuffle = true } = body as {
    cohort_id?: string;
    group_size?: number;
    name_prefix?: string;
    shuffle?: boolean;
  };

  if (!cohort_id) return NextResponse.json({ error: 'cohort_id required' }, { status: 400 });
  if (!group_size || group_size < 2) return NextResponse.json({ error: 'group_size must be at least 2' }, { status: 400 });

  const supabase = adminClient();

  // Fetch active students in the cohort who are NOT already in any group
  const { data: grouped } = await supabase.from('group_members').select('student_id');
  const groupedIds = (grouped ?? []).map((r: any) => r.student_id as string);

  let studQuery = supabase
    .from('students')
    .select('id')
    .eq('cohort_id', cohort_id)
    .eq('status', 'active');

  if (groupedIds.length > 0) {
    studQuery = studQuery.not('id', 'in', `(${groupedIds.join(',')})`);
  }

  const { data: students, error: studErr } = await studQuery;

  if (studErr) return NextResponse.json({ error: studErr.message }, { status: 500 });
  if (!students?.length) return NextResponse.json({ error: 'No ungrouped students found in this cohort' }, { status: 422 });

  // Optionally shuffle student order
  const ordered = shuffle
    ? [...students].sort(() => Math.random() - 0.5)
    : students;

  // Split into chunks of group_size
  const chunks: string[][] = [];
  for (let i = 0; i < ordered.length; i += group_size) {
    chunks.push(ordered.slice(i, i + group_size).map(s => s.id));
  }

  // Find the highest existing group number for this prefix to avoid name collisions
  const { data: existing } = await supabase
    .from('groups')
    .select('name')
    .eq('cohort_id', cohort_id)
    .ilike('name', `${name_prefix} %`);

  const existingNumbers = (existing ?? [])
    .map(g => parseInt(g.name.replace(name_prefix, '').trim(), 10))
    .filter(n => !isNaN(n));
  const startIndex = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;

  // Create each group and assign members
  const created: { id: string; name: string; size: number }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const name = `${name_prefix} ${startIndex + i}`;
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({ name, cohort_id, created_by: user.id })
      .select('id')
      .single();

    if (gErr || !group) continue;

    const memberRows = chunks[i].map((sid, idx) => ({ group_id: group.id, student_id: sid, is_leader: idx === 0 }));
    await supabase.from('group_members').insert(memberRows);

    created.push({ id: group.id, name, size: chunks[i].length });
  }

  return NextResponse.json({
    groups_created: created.length,
    students_assigned: created.reduce((sum, g) => sum + g.size, 0),
    students_total: ordered.length,
    groups: created,
  }, { status: 201 });
}
