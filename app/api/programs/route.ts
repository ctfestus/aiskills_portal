import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

async function resolveInstructor(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  const { data: profile } = await adminClient().from('students').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin' && profile?.role !== 'instructor') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await resolveInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await adminClient()
    .from('programs')
    .select('id, name, description, skills, badge_image_url, issue_mode, completion_text, created_at')
    .eq('issued_by', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const user = await resolveInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'Program name is required' }, { status: 400 });

  const validModes = ['certificate_only', 'badge_only', 'both'];
  const issueMode = validModes.includes(body.issue_mode) ? body.issue_mode : 'certificate_only';

  const { data, error } = await adminClient()
    .from('programs')
    .insert({
      name,
      description:     body.description?.trim() || null,
      skills:          Array.isArray(body.skills) ? body.skills.map((s: string) => s.trim()).filter(Boolean) : [],
      badge_image_url: body.badge_image_url || null,
      issue_mode:      issueMode,
      completion_text: body.completion_text?.trim() || null,
      issued_by:       user.id,
    })
    .select('id, name, description, skills, badge_image_url, issue_mode, completion_text, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const user = await resolveInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const validModes = ['certificate_only', 'badge_only', 'both'];
  const update: Record<string, unknown> = {};
  if (rest.name?.trim())        update.name            = rest.name.trim();
  if (rest.description !== undefined) update.description = rest.description?.trim() || null;
  if (Array.isArray(rest.skills))    update.skills      = rest.skills.map((s: string) => s.trim()).filter(Boolean);
  if (rest.badge_image_url !== undefined) update.badge_image_url = rest.badge_image_url || null;
  if (validModes.includes(rest.issue_mode)) update.issue_mode = rest.issue_mode;
  if (rest.completion_text !== undefined) update.completion_text = rest.completion_text?.trim() || null;

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('programs')
    .update(update)
    .eq('id', id)
    .eq('issued_by', user.id)
    .select('id, name, description, skills, badge_image_url, issue_mode, completion_text, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveInstructor(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await adminClient()
    .from('programs')
    .delete()
    .eq('id', id)
    .eq('issued_by', user.id);

  if (error) return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
