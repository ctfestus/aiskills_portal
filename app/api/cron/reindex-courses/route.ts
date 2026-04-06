/**
 * Nightly cron -- Re-sync vector search index with the database.
 * Triggered by QStash at 02:00 UTC every day.
 *
 * Bulk-upserts all published courses, guided projects, and virtual experiences
 * into the Upstash Vector index so that search and recommendations always
 * reflect the current state of the DB -- no manual resets needed.
 *
 * Schedule in QStash console:
 *   URL:      https://{your-domain}/api/cron/reindex-courses
 *   Cron:     0 2 * * *
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

  // Fetch ALL forms (all statuses) so we can detect which ones should be removed from the index
  const { data: allForms, error } = await supabase
    .from('forms')
    .select('id, title, config, cohort_ids, status, content_type, slug');

  if (error) {
    console.error('[cron/reindex-courses] DB fetch error:', error.message);
    return NextResponse.json({ error: 'DB fetch failed' }, { status: 500 });
  }

  const isCourseType = (f: any) =>
    f.content_type === 'course' ||
    f.content_type === 'guided_project' ||
    f.content_type === 'virtual_experience' ||
    Boolean(f.config?.isCourse) ||
    Boolean(f.config?.isGuidedProject) ||
    Boolean(f.config?.isVirtualExperience);

  // What should be in the index: published courses/VEs/guided-projects
  const toIndex = (allForms ?? []).filter((f: any) => f.status === 'published' && isCourseType(f));

  // What should NOT be in the index: draft courses or wrong content types that may have been indexed before
  const toDelete = (allForms ?? [])
    .filter((f: any) => isCourseType(f) && f.status !== 'published')
    .map((f: any) => f.id);

  // Remove stale entries (draft courses, etc.) from the vector index
  if (toDelete.length) {
    await index.delete(toDelete).catch(e => console.error('[cron/reindex-courses] delete stale error:', e?.message));
    console.log(`[cron/reindex-courses] Removed ${toDelete.length} stale entries`);
  }

  if (!toIndex.length) {
    console.log('[cron/reindex-courses] No published courses to index');
    return NextResponse.json({ indexed: 0, removed: toDelete.length });
  }

  const vectors = toIndex.map((f: any) => {
    const isProject = f.content_type === 'guided_project' || Boolean(f.config?.isGuidedProject);
    const isVE      = f.content_type === 'virtual_experience' || Boolean(f.config?.isVirtualExperience);
    return {
      id:   f.id,
      data: buildCourseEmbedText(f.config, f.title),
      metadata: {
        formId:      f.id,
        title:       f.title,
        slug:        f.slug ?? f.id,
        cohortIds:   f.cohort_ids ?? [],
        status:      f.status ?? 'published',
        contentType: isProject ? 'guided_project' : isVE ? 'virtual_experience' : 'course',
        coverImage:  f.config?.coverImage ?? null,
      },
    };
  });

  await index.upsert(vectors);
  console.log(`[cron/reindex-courses] Indexed ${vectors.length} courses, removed ${toDelete.length} stale entries`);
  return NextResponse.json({ indexed: vectors.length, removed: toDelete.length });
}
