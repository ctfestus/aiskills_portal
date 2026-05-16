import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

async function getSessionUser(req: NextRequest): Promise<{ id: string; role: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user) return null;
  const { data: student } = await adminClient()
    .from('students')
    .select('role')
    .eq('id', user.id)
    .single();
  return { id: user.id, role: student?.role ?? 'student' };
}

function isStaff(role: string) {
  return role === 'admin' || role === 'instructor';
}

// GET - list datasets
// Public (no auth): published only
// Authenticated student: published only
// Authenticated staff: all (including drafts)
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);

  const db = adminClient();
  let query = db
    .from('data_center_datasets')
    .select('*')
    .order('created_at', { ascending: false });

  const showAll = sessionUser && isStaff(sessionUser.role);
  if (!showAll) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ datasets: data });
}

// POST - create dataset (staff only)
export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaff(sessionUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const {
    title, description, cover_image_url, cover_image_alt,
    tags, category, sample_questions, file_url, file_name,
    row_count, column_info, is_published,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('data_center_datasets')
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      cover_image_url: cover_image_url ?? null,
      cover_image_alt: cover_image_alt ?? null,
      tags: tags ?? [],
      category: category?.trim() ?? null,
      sample_questions: sample_questions ?? [],
      file_url: file_url?.trim() ?? null,
      file_name: file_name?.trim() ?? null,
      row_count: row_count ?? null,
      column_info: column_info ?? [],
      is_published: is_published ?? false,
      created_by: sessionUser.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dataset: data });
}

// PUT - update dataset (staff only)
export async function PUT(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaff(sessionUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const allowed = [
    'title', 'description', 'cover_image_url', 'cover_image_alt',
    'tags', 'category', 'sample_questions', 'file_url', 'file_name',
    'row_count', 'column_info', 'is_published',
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key];
  }
  if (update.title && typeof update.title === 'string') update.title = update.title.trim();

  const { data, error } = await adminClient()
    .from('data_center_datasets')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dataset: data });
}

// DELETE - delete dataset (staff only)
export async function DELETE(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaff(sessionUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await adminClient()
    .from('data_center_datasets')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
