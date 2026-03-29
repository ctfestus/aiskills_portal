import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminClient().auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { formId } = body;
  if (!formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });

  const supabase = adminClient();

  // Verify caller owns the form (or is admin)
  const { data: form } = await supabase
    .from('forms')
    .select('user_id, title, slug, content_type, cohort_ids')
    .eq('id', formId)
    .single();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (form.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cohortIds: string[] = form.cohort_ids ?? [];
  if (!cohortIds.length) return NextResponse.json({ ok: true, skipped: true });

  // All notification data derived from the server-side form record -- nothing trusted from body
  sendAssignmentNotifications({
    cohortIds,
    title:       form.title || '',
    slug:        form.slug  || '',
    contentType: form.content_type,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
