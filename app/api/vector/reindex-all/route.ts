/**
 * POST /api/vector/reindex-all
 * Bulk-indexes all published courses and guided projects.
 * Call this once after setting up the vector index, then it stays current
 * via the per-course fire-and-forget calls on save/publish.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVectorIndex, buildCourseEmbedText } from '@/lib/vector';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.REINDEX_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }
  if (req.headers.get('x-reindex-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const index = getVectorIndex();
  if (!index) return NextResponse.json({ error: 'Vector not configured' }, { status: 503 });

  const supabase = adminClient();

  // Fetch ALL published forms -- filter client-side to catch legacy rows
  // where content_type='form' but config.isCourse / config.isGuidedProject is set
  const { data: forms, error } = await supabase
    .from('forms')
    .select('id, title, config, cohort_ids, status, content_type, slug')
    .eq('status', 'published');

  if (error) { console.error('[vector/reindex-all] fetch error:', error); return NextResponse.json({ error: 'Failed to fetch forms.' }, { status: 500 }); }

  const toIndex = (forms ?? []).filter((f: any) =>
    f.content_type === 'course' ||
    f.content_type === 'guided_project' ||
    f.content_type === 'virtual_experience' ||
    Boolean(f.config?.isCourse) ||
    Boolean(f.config?.isGuidedProject) ||
    Boolean(f.config?.isVirtualExperience),
  );

  if (!toIndex.length) return NextResponse.json({ indexed: 0 });

  const vectors = toIndex.map((f: any) => ({
    id:       f.id,
    data:     buildCourseEmbedText(f.config, f.title),
    metadata: {
      formId:      f.id,
      title:       f.title,
      slug:        f.slug ?? f.id,
      cohortIds:   f.cohort_ids ?? [],
      status:      f.status ?? 'published',
      contentType: (f.content_type === 'guided_project' || Boolean(f.config?.isGuidedProject)) ? 'guided_project'
               : (f.content_type === 'virtual_experience' || Boolean(f.config?.isVirtualExperience)) ? 'virtual_experience'
               : 'course',
      coverImage:  f.config?.coverImage ?? null,
    },
  }));

  await index.upsert(vectors);

  return NextResponse.json({ indexed: vectors.length });
}
