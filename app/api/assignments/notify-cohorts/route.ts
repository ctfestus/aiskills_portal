import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

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

  const { assignmentId, cohortIds } = body;
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
  if (!Array.isArray(cohortIds) || !cohortIds.length) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, created_by')
    .eq('id', assignmentId)
    .maybeSingle();

  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (assignment.created_by !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  sendAssignmentNotifications({
    cohortIds,
    title:       assignment.title,
    contentType: 'assignment',
    formUrl:     '/student#assignments',
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
