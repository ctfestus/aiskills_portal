import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

type WorkspaceLink = { url: string; label?: string };
type WorkspaceFile = { url: string; name: string };

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

function cleanLinks(value: unknown): WorkspaceLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      url: String(item?.url ?? '').trim(),
      label: String(item?.label ?? '').trim(),
    }))
    .filter(item => item.url)
    .slice(0, 50);
}

function cleanFiles(value: unknown): WorkspaceFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      url: String(item?.url ?? '').trim(),
      name: String(item?.name ?? 'File').trim() || 'File',
    }))
    .filter(item => item.url)
    .slice(0, 50);
}

async function validateAccess(assignmentId: string, groupId: string, userId: string) {
  const supabase = adminClient();
  const [{ data: assignment }, { data: membership }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, group_ids, status')
      .eq('id', assignmentId)
      .maybeSingle(),
    supabase
      .from('group_members')
      .select('group_id, is_leader')
      .eq('group_id', groupId)
      .eq('student_id', userId)
      .maybeSingle(),
  ]);

  if (!assignment || assignment.status !== 'published') {
    return { ok: false as const, status: 404, error: 'Assignment not found' };
  }
  if (!membership) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  const groupIds = Array.isArray(assignment.group_ids) ? assignment.group_ids : [];
  if (!groupIds.includes(groupId)) {
    return { ok: false as const, status: 403, error: 'Assignment is not assigned to this group' };
  }

  return { ok: true as const, isLeader: !!membership.is_leader };
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get('assignmentId');
  const groupId = url.searchParams.get('groupId');
  if (!assignmentId || !groupId) {
    return NextResponse.json({ error: 'assignmentId and groupId required' }, { status: 400 });
  }

  const access = await validateAccess(assignmentId, groupId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await adminClient()
    .from('assignment_group_workspaces')
    .select('id, assignment_id, group_id, notes, links, files, updated_by, updated_at')
    .eq('assignment_id', assignmentId)
    .eq('group_id', groupId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not load workspace' }, { status: 500 });

  return NextResponse.json({
    workspace: data ?? {
      assignment_id: assignmentId,
      group_id: groupId,
      notes: '',
      links: [],
      files: [],
      updated_by: null,
      updated_at: null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const assignmentId = String(body.assignmentId ?? '').trim();
  const groupId = String(body.groupId ?? '').trim();
  if (!assignmentId || !groupId) {
    return NextResponse.json({ error: 'assignmentId and groupId required' }, { status: 400 });
  }

  const access = await validateAccess(assignmentId, groupId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.isLeader) return NextResponse.json({ error: 'Only the group leader can update coordination details' }, { status: 403 });

  const notes = String(body.notes ?? '').slice(0, 50000);
  const links = cleanLinks(body.links);
  const files = cleanFiles(body.files);

  const { data, error } = await adminClient()
    .from('assignment_group_workspaces')
    .upsert({
      assignment_id: assignmentId,
      group_id: groupId,
      notes,
      links,
      files,
      updated_by: user.id,
    }, { onConflict: 'assignment_id,group_id' })
    .select('id, assignment_id, group_id, notes, links, files, updated_by, updated_at')
    .single();

  if (error) return NextResponse.json({ error: 'Could not save workspace' }, { status: 500 });

  return NextResponse.json({ workspace: data });
}
