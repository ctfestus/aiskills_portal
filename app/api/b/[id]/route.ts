import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: earned } = await serviceSupabase
    .from('student_badges')
    .select('student_id, badge_id, awarded_at')
    .eq('id', id)
    .maybeSingle();

  if (!earned) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: badge }, { data: student }] = await Promise.all([
    serviceSupabase.from('badges').select('name, description, icon, color, image_url, category').eq('id', earned.badge_id).single(),
    serviceSupabase.from('students').select('full_name, avatar_url, username').eq('id', earned.student_id).single(),
  ]);

  if (!badge || !student) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    studentName:      student.full_name,
    studentAvatarUrl: student.avatar_url ?? null,
    studentUsername:  student.username   ?? null,
    badgeName:        badge.name,
    badgeDescription: badge.description,
    badgeImageUrl:    badge.image_url    ?? null,
    badgeIcon:        badge.icon,
    badgeColor:       badge.color,
    badgeCategory:    badge.category,
    awardedAt:        earned.awarded_at,
  });
}
