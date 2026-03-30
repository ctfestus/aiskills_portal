/**
 * POST /api/vector/index-course
 * Upserts a course (or guided project) into the Upstash Vector index.
 * Called fire-and-forget whenever a course is created/updated/published.
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
  const { data: form, error } = await supabase
    .from('forms')
    .select('id, title, config, cohort_ids, status, content_type, slug')
    .eq('id', formId)
    .single();

  if (error || !form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  // Only index courses and guided projects
  const isCourse  = form.content_type === 'course' || Boolean(form.config?.isCourse);
  const isProject = form.content_type === 'guided_project' || Boolean(form.config?.isGuidedProject);
  const isVE      = form.content_type === 'virtual_experience' || Boolean(form.config?.isVirtualExperience);
  if (!isCourse && !isProject && !isVE) return NextResponse.json({ ok: true, skipped: 'not a course' });

  const data = buildCourseEmbedText(form.config, form.title);

  await index.upsert({
    id:       form.id,
    data,
    metadata: {
      formId:      form.id,
      title:       form.title,
      slug:        form.slug ?? form.id,
      cohortIds:   form.cohort_ids ?? [],
      status:      form.status ?? 'published',
      contentType: isProject ? 'guided_project' : isVE ? 'virtual_experience' : 'course',
      coverImage:  form.config?.coverImage ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
