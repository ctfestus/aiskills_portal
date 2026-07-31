import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';

// GET /api/linkedin-share?contentId=<course|ve id>
//
// Read-only reporting: who shared for this course or virtual experience. There is no review step and
// nothing to action here -- a row exists only because the URL was a LinkedIn post, it named the
// student as its author, and nobody had claimed it before, all decided at claim time.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['instructor', 'admin', 'staff']);
  if (isAuthError(auth)) return auth.error;
  const { user, role } = auth;

  const contentId = new URL(req.url).searchParams.get('contentId');
  if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });

  const supabase = adminClient();

  // Staff read everything (by design); an instructor only their own content.
  if (role === 'instructor') {
    const [{ data: course }, { data: ve }] = await Promise.all([
      supabase.from('courses').select('user_id').eq('id', contentId).maybeSingle(),
      supabase.from('virtual_experiences').select('user_id').eq('id', contentId).maybeSingle(),
    ]);
    const owner = (course as any)?.user_id ?? (ve as any)?.user_id;
    if (!owner || owner !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('linkedin_shares')
    .select('id, student_id, item_id, post_url, points, created_at, students(full_name, email)')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[linkedin-share] list failed', error);
    return NextResponse.json({ error: 'Failed to load shares' }, { status: 500 });
  }

  return NextResponse.json({
    shares: (data ?? []).map((r: any) => ({
      id:           r.id,
      studentId:    r.student_id,
      studentName:  r.students?.full_name ?? '',
      studentEmail: r.students?.email ?? '',
      itemId:       r.item_id,
      postUrl:      r.post_url,
      points:       r.points,
      createdAt:    r.created_at,
    })),
  });
}
