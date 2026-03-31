/**
 * POST /api/vector/recommend
 * Returns up to 3 courses semantically similar to the one the student just completed,
 * filtered to their cohort and excluding already-completed courses.
 *
 * Body: { completedFormId: string }
 * Auth: Bearer token (Supabase session)
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

async function getSessionUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await adminClient().auth.getUser(token);
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const index = getVectorIndex();
  if (!index) return NextResponse.json({ recommendations: [] });

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { completedFormId } = await req.json();
  if (!completedFormId) return NextResponse.json({ error: 'completedFormId required' }, { status: 400 });

  const supabase = adminClient();

  // 1. Get student profile (cohort + email)
  const { data: student } = await supabase
    .from('students')
    .select('cohort_id, email')
    .eq('id', user.id)
    .single();

  // 2. Get the completed course to build the query vector + its cohorts
  const { data: completedForm } = await supabase
    .from('forms')
    .select('title, config, cohort_ids')
    .eq('id', completedFormId)
    .single();

  if (!completedForm) return NextResponse.json({ recommendations: [] });

  // 3. Get all course IDs the student has already started
  const { data: attempts } = await supabase
    .from('course_attempts')
    .select('form_id')
    .eq('student_id', user.id);

  const seenIds = new Set((attempts ?? []).map((a: any) => a.form_id));
  seenIds.add(completedFormId);

  // 4. Query vector index for similar courses
  const queryText = buildCourseEmbedText(completedForm.config, completedForm.title);
  const results = await index.query({
    data:            queryText,
    topK:            12,
    includeMetadata: true,
  });

  // 5. Filter: published, not already seen, cohort-scoped when possible
  // If student has a cohort, filter to that cohort.
  // Otherwise (instructor previewing) filter to cohorts of the completed course.
  const cohortId       = student?.cohort_id ?? null;
  const fallbackCohorts: string[] = completedForm.cohort_ids ?? [];

  const candidates = results
    .filter((r: any) => {
      const m = r.metadata;
      if (!m) return false;
      if (m.status !== 'published') return false;
      if (seenIds.has(m.formId)) return false;
      const itemCohorts: string[] = Array.isArray(m.cohortIds) ? m.cohortIds : [];
      if ((r.score ?? 0) < 0.6) return false; // only genuinely similar content
      if (cohortId) return itemCohorts.includes(cohortId);
      // Instructor fallback: show anything in the same cohorts as the completed course
      return fallbackCohorts.some(c => itemCohorts.includes(c));
    })
    .slice(0, 12);

  if (!candidates.length) return NextResponse.json({ recommendations: [] });

  // Verify candidates still exist in the database (vector index may contain stale/deleted courses)
  const candidateIds = candidates.map((r: any) => r.metadata.formId);
  const { data: existingForms } = await supabase
    .from('forms')
    .select('id')
    .in('id', candidateIds);

  const existingIds = new Set((existingForms ?? []).map((f: any) => f.id));

  const recs = candidates
    .filter((r: any) => existingIds.has(r.metadata.formId))
    .slice(0, 3)
    .map((r: any) => ({
      formId:     r.metadata.formId,
      title:      r.metadata.title,
      slug:       r.metadata.slug,
      coverImage: r.metadata.coverImage ?? null,
      score:      Math.round((r.score ?? 0) * 100),
    }));

  return NextResponse.json({ recommendations: recs });
}
