import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Server-only loader for public earned-badge data. Shared by the /api/b route
// and the server-rendered /b/[id] page.

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface BadgeData {
  studentName:      string;
  studentAvatarUrl: string | null;
  studentUsername:  string | null;
  badgeName:        string;
  badgeDescription: string;
  badgeImageUrl:    string | null;
  badgeIcon:        string;
  badgeColor:       string;
  badgeCategory:    string | null;
  awardedAt:        string;
}

export type BadgeResult =
  | { status: 'notfound' }
  | { status: 'ready'; data: BadgeData };

export async function loadBadge(id: string): Promise<BadgeResult> {
  const { data: earned } = await svc
    .from('student_badges')
    .select('student_id, badge_id, awarded_at')
    .eq('id', id)
    .maybeSingle();

  if (!earned) return { status: 'notfound' };

  const [{ data: badge }, { data: student }] = await Promise.all([
    svc.from('badges').select('name, description, icon, color, image_url, category').eq('id', earned.badge_id).single(),
    svc.from('students').select('full_name, avatar_url, username').eq('id', earned.student_id).single(),
  ]);

  if (!badge || !student) return { status: 'notfound' };

  return {
    status: 'ready',
    data: {
      studentName:      student.full_name,
      studentAvatarUrl: student.avatar_url ?? null,
      studentUsername:  student.username   ?? null,
      badgeName:        badge.name,
      badgeDescription: badge.description,
      badgeImageUrl:    badge.image_url    ?? null,
      badgeIcon:        badge.icon,
      badgeColor:       badge.color,
      badgeCategory:    badge.category     ?? null,
      awardedAt:        earned.awarded_at,
    },
  };
}
