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

  const { cohortIds, title, slug, contentType } = body;
  if (!Array.isArray(cohortIds) || !cohortIds.length) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (!title || !contentType) {
    return NextResponse.json({ error: 'title and contentType are required' }, { status: 400 });
  }

  // Fire-and-forget -- respond immediately, send in background
  sendAssignmentNotifications({
    cohortIds,
    title,
    slug: slug || '',
    contentType,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
