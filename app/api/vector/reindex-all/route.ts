/**
 * POST /api/vector/reindex-all
 * Bulk-indexes all published courses and virtual experiences.
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

  const [{ data: courses, error: ce }, { data: ves, error: ve }] = await Promise.all([
    supabase.from('courses').select('id, title, questions, cover_image, cohort_ids, status, slug, learn_outcomes').eq('status', 'published'),
    supabase.from('virtual_experiences').select('id, title, modules, cover_image, cohort_ids, status, slug, industry, difficulty, role, company, tagline, learn_outcomes').eq('status', 'published'),
  ]);

  if (ce || ve) {
    console.error('[vector/reindex-all] fetch error:', ce?.message ?? ve?.message);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }

  const vectors: { id: string; data: string; metadata: Record<string, any> }[] = [];

  for (const c of courses ?? []) {
    const config = { questions: c.questions, coverImage: c.cover_image, learnOutcomes: c.learn_outcomes };
    vectors.push({
      id:   c.id,
      data: buildCourseEmbedText(config, c.title),
      metadata: {
        formId:      c.id,
        title:       c.title,
        slug:        c.slug ?? c.id,
        cohortIds:   c.cohort_ids ?? [],
        status:      c.status ?? 'published',
        contentType: 'course',
        coverImage:  c.cover_image ?? null,
      },
    });
  }

  for (const v of ves ?? []) {
    const config = { modules: v.modules, coverImage: v.cover_image, tagline: v.tagline, industry: v.industry, difficulty: v.difficulty, role: v.role, company: v.company, learnOutcomes: v.learn_outcomes };
    vectors.push({
      id:   v.id,
      data: buildCourseEmbedText(config, v.title),
      metadata: {
        formId:      v.id,
        title:       v.title,
        slug:        v.slug ?? v.id,
        cohortIds:   v.cohort_ids ?? [],
        status:      v.status ?? 'published',
        contentType: 'virtual_experience',
        coverImage:  v.cover_image ?? null,
      },
    });
  }

  if (!vectors.length) return NextResponse.json({ indexed: 0 });

  await index.upsert(vectors);

  return NextResponse.json({ indexed: vectors.length });
}
