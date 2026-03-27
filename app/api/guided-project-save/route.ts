import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';

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

  const { editId, title, config, coverImage, cohort_ids } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!config)        return NextResponse.json({ error: 'Config is required' }, { status: 400 });

  const finalConfig = { ...config, isGuidedProject: true, coverImage: coverImage || config.coverImage || '' };

  const payload: any = {
    title:        title.trim(),
    config:       finalConfig,
    cohort_ids:   Array.isArray(cohort_ids) ? cohort_ids : [],
    content_type: 'guided_project',
    description:  config.tagline || '',
  };

  if (editId) {
    const { error } = await adminClient()
      .from('forms')
      .update(payload)
      .eq('id', editId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[guided-project-save] update error:', error);
      return NextResponse.json({ error: `${error.message} (code: ${error.code})` }, { status: 500 });
    }
    return NextResponse.json({ id: editId });
  }

  // Generate slug
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug  = `${base}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await adminClient()
    .from('forms')
    .insert({ ...payload, slug, user_id: user.id })
    .select('id, slug')
    .single();

  if (error) {
    console.error('[guided-project-save] insert error:', error);
    return NextResponse.json({ error: `${error.message} (code: ${error.code})` }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, slug: data.slug });
}
