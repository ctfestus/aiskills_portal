import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { sendAssignmentReminders } from '@/lib/remind-unsubmitted';

export const dynamic = 'force-dynamic';

// On-demand: email students who have not submitted an assignment. Instructor/admin only.
// Used by the MCP remind_unsubmitted tool.
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

  const { data: profile } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!profile || !['instructor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assignmentId, cooldownDays } = body;
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });

  const result = await sendAssignmentReminders(supabase, assignmentId, { cooldownDays: cooldownDays ?? 0 });
  if (result.error) {
    const status = result.error === 'Assignment not found' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, ...result });
}
