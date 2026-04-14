/**
 * Nightly cron -- Re-sync vector search index with the database.
 * Triggered by QStash at 02:00 UTC every day.
 * Bulk-upserts all published courses and virtual experiences into the Upstash Vector index.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVectorIndex, buildCourseEmbedText } from '@/lib/vector';
import { verifyQStashRequest } from '@/lib/qstash';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { valid } = await verifyQStashRequest(req);
  if (!valid) {
    console.error('[cron/reindex-courses] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const index = getVectorIndex();
  if (!index) {
    console.warn('[cron/reindex-courses] Vector index not configured -- skipping');
    return NextResponse.json({ skipped: 'vector not configured' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch all courses and virtual experiences (all statuses) for index sync
  const [{ data: allCourses, error: ce }, { data: allVEs, error: ve }] = await Promise.all([
    supabase.from('courses').select('id, title, questions, cover_image, cohort_ids, status, slug, learn_outcomes'),
    supabase.from('virtual_experiences').select('id, title, modules, cover_image, cohort_ids, status, slug, industry, difficulty, role, company, tagline, learn_outcomes'),
  ]);

  if (ce || ve) {
    console.error('[cron/reindex-courses] DB fetch error:', ce?.message ?? ve?.message);
    return NextResponse.json({ error: 'DB fetch failed' }, { status: 500 });
  }

  // Build a config-compatible shape so buildCourseEmbedText works unchanged
  const toIndex: { id: string; title: string; slug: string; cohort_ids: string[]; status: string; content_type: string; config: any }[] = [];
  const toDelete: string[] = [];

  for (const c of allCourses ?? []) {
    const config = { questions: c.questions, coverImage: c.cover_image, learnOutcomes: c.learn_outcomes };
    if (c.status === 'published') toIndex.push({ id: c.id, title: c.title, slug: c.slug, cohort_ids: c.cohort_ids, status: c.status, content_type: 'course', config });
    else toDelete.push(c.id);
  }

  for (const v of allVEs ?? []) {
    const config = { modules: v.modules, coverImage: v.cover_image, tagline: v.tagline, industry: v.industry, difficulty: v.difficulty, role: v.role, company: v.company, learnOutcomes: v.learn_outcomes };
    if (v.status === 'published') toIndex.push({ id: v.id, title: v.title, slug: v.slug, cohort_ids: v.cohort_ids, status: v.status, content_type: 'virtual_experience', config });
    else toDelete.push(v.id);
  }

  if (toDelete.length) {
    await index.delete(toDelete).catch(e => console.error('[cron/reindex-courses] delete stale error:', e?.message));
    console.log(`[cron/reindex-courses] Removed ${toDelete.length} stale entries`);
  }

  if (!toIndex.length) {
    console.log('[cron/reindex-courses] No published content to index');
    return NextResponse.json({ indexed: 0, removed: toDelete.length });
  }

  const vectors = toIndex.map(f => ({
    id:   f.id,
    data: buildCourseEmbedText(f.config, f.title),
    metadata: {
      formId:      f.id,
      title:       f.title,
      slug:        f.slug ?? f.id,
      cohortIds:   f.cohort_ids ?? [],
      status:      f.status,
      contentType: f.content_type,
      coverImage:  f.config?.coverImage ?? null,
    },
  }));

  await index.upsert(vectors);
  console.log(`[cron/reindex-courses] Indexed ${vectors.length} items, removed ${toDelete.length} stale entries`);
  return NextResponse.json({ indexed: vectors.length, removed: toDelete.length });
}
