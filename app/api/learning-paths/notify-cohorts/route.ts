import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { sendPathNotification } from '@/lib/send-path-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { learningPathId, cohortIds } = body;
  if (!learningPathId) return NextResponse.json({ error: 'learningPathId is required' }, { status: 400 });
  if (!Array.isArray(cohortIds) || !cohortIds.length) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: lp } = await supabase
    .from('learning_paths')
    .select('id, title, description, item_ids, instructor_id')
    .eq('id', learningPathId)
    .maybeSingle();

  if (!lp) return NextResponse.json({ error: 'Learning path not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (lp.instructor_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await sendPathNotification(supabase, lp, cohortIds);
  } catch (err) {
    console.error('[learning-paths/notify-cohorts] error:', err);
    return NextResponse.json({ error: 'Notification failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
