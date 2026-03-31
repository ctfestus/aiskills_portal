/**
 * GET /api/vector/search?q=...&cohort_id=...
 * Semantic course search -- finds courses by meaning, not keywords.
 * Restricted to courses in the student's own cohort.
 *
 * Auth: Bearer token (Supabase session)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVectorIndex } from '@/lib/vector';

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

export async function GET(req: NextRequest) {
  const index = getVectorIndex();
  if (!index) return NextResponse.json({ results: [] });

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q        = searchParams.get('q')?.trim() ?? '';
  const cohortId = searchParams.get('cohort_id')?.trim() ?? '';

  if (!q || q.length < 3) return NextResponse.json({ results: [] });

  const supabase = adminClient();

  // Verify the student belongs to this cohort
  const { data: student } = await supabase
    .from('students')
    .select('cohort_id')
    .eq('id', user.id)
    .single();

  const effectiveCohortId = cohortId || student?.cohort_id;
  if (!effectiveCohortId) return NextResponse.json({ results: [] });
  if (student?.cohort_id && cohortId && student.cohort_id !== cohortId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Query vector index
  const results = await index.query({
    data:            q,
    topK:            20,
    includeMetadata: true,
  });

  // Filter: published + in cohort, score > 0.6 (relevance threshold)
  const candidates = results
    .filter((r: any) => {
      const m = r.metadata;
      if (!m) return false;
      if (m.status !== 'published') return false;
      if (!Array.isArray(m.cohortIds) || !m.cohortIds.includes(effectiveCohortId)) return false;
      if ((r.score ?? 0) < 0.6) return false;
      return true;
    })
    .slice(0, 20);

  if (!candidates.length) return NextResponse.json({ results: [] });

  // Verify candidates still exist in the database (vector index may contain stale/deleted courses)
  const candidateIds = candidates.map((r: any) => r.metadata.formId);
  const { data: existingForms } = await supabase
    .from('forms')
    .select('id')
    .in('id', candidateIds);

  const existingIds = new Set((existingForms ?? []).map((f: any) => f.id));

  const filtered = candidates
    .filter((r: any) => existingIds.has(r.metadata.formId))
    .slice(0, 8)
    .map((r: any) => ({
      formId:     r.metadata.formId,
      title:      r.metadata.title,
      slug:       r.metadata.slug,
      coverImage: r.metadata.coverImage ?? null,
      score:      Math.round((r.score ?? 0) * 100),
    }));

  return NextResponse.json({ results: filtered });
}
