/**
 * POST /api/vector/index-course
 * Upserts a course or virtual experience into the Upstash Vector index.
 * Called fire-and-forget whenever a course/VE is created/updated/published.
 *
 * Body: { formId: string }
 * Auth: internal -- must supply INTERNAL_API_SECRET header OR Supabase service call
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVectorIndex, buildCourseEmbedText } from '@/lib/vector';
import { getRedis } from '@/lib/redis';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // 1. Shared-secret gate -- internal callers only
  const secret = process.env.REINDEX_SECRET;
  if (!secret || req.headers.get('x-reindex-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Rate limiting -- 10 requests per IP per minute (defence-in-depth)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const redis = getRedis();
  if (redis) {
    try {
      const rlKey = `rate:index-course:${ip}`;
      const count = await redis.incr(rlKey);
      if (count === 1) await redis.expire(rlKey, 60);
      if (count > 10) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    } catch { /* non-fatal -- proceed if Redis unavailable */ }
  }

  const index = getVectorIndex();
  if (!index) return NextResponse.json({ ok: true, skipped: 'vector not configured' });

  let formId: string;
  try {
    ({ formId } = await req.json());
    if (!formId) throw new Error('missing formId');
  } catch {
    return NextResponse.json({ error: 'formId required' }, { status: 400 });
  }

  const supabase = adminClient();

  // Look up the content across courses and virtual_experiences
  const [{ data: course }, { data: ve }] = await Promise.all([
    supabase.from('courses').select('id, title, questions, cover_image, cohort_ids, status, slug, learn_outcomes').eq('id', formId).maybeSingle(),
    supabase.from('virtual_experiences').select('id, title, modules, cover_image, cohort_ids, status, slug, industry, difficulty, role, company, tagline, learn_outcomes').eq('id', formId).maybeSingle(),
  ]);

  let content: any = null;
  let contentType: string = '';
  let config: any = {};

  if (course) {
    content = course;
    contentType = 'course';
    config = { questions: course.questions, coverImage: course.cover_image, learnOutcomes: course.learn_outcomes };
  } else if (ve) {
    content = ve;
    contentType = 'virtual_experience';
    config = { modules: ve.modules, coverImage: ve.cover_image, tagline: ve.tagline, industry: ve.industry, difficulty: ve.difficulty, role: ve.role, company: ve.company, learnOutcomes: ve.learn_outcomes };
  }

  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

  const data = buildCourseEmbedText(config, content.title);

  await index.upsert({
    id:       content.id,
    data,
    metadata: {
      formId:      content.id,
      title:       content.title,
      slug:        content.slug ?? content.id,
      cohortIds:   content.cohort_ids ?? [],
      status:      content.status ?? 'published',
      contentType,
      coverImage:  config.coverImage ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
