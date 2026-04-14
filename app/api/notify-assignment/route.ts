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

  const { formId } = body;
  if (!formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });

  // Look up the content across all three tables
  const [c, e, v] = await Promise.all([
    supabase.from('courses').select('user_id, title, slug, cohort_ids').eq('id', formId).maybeSingle(),
    supabase.from('events').select('user_id, title, slug, cohort_ids').eq('id', formId).maybeSingle(),
    supabase.from('virtual_experiences').select('user_id, title, slug, cohort_ids').eq('id', formId).maybeSingle(),
  ]);

  let content: any = null;
  let contentType: string = '';

  if (c.data)      { content = c.data; contentType = 'course'; }
  else if (e.data) { content = e.data; contentType = 'event'; }
  else if (v.data) { content = v.data; contentType = 'virtual_experience'; }

  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (content.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cohortIds: string[] = content.cohort_ids ?? [];
  if (!cohortIds.length) return NextResponse.json({ ok: true, skipped: true });

  sendAssignmentNotifications({
    cohortIds,
    title:       content.title || '',
    slug:        content.slug  || '',
    contentType,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
