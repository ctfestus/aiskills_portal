import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = adminClient();
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: student } = await db.from('students').select('role').eq('id', user.id).single();
  if (!student || !['instructor', 'admin'].includes(student.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const syncUrl = process.env.PLATFORM_SYNC_URL;
  const syncKey = process.env.PLATFORM_SYNC_KEY;
  if (!syncUrl || !syncKey)
    return NextResponse.json({ error: 'Sync not configured on this platform.' }, { status: 503 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, id } = body;
  if (!type || !id)
    return NextResponse.json({ error: 'type and id required' }, { status: 400 });

  let payload: any;

  if (type === 'course') {
    const { data: c, error } = await db.from('courses').select('*').eq('id', id).eq('user_id', user.id).single();
    if (error || !c) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    payload = {
      exportVersion: 1,
      type: 'course',
      title: c.title,
      exportedAt: new Date().toISOString(),
      config: {
        isCourse: true,
        title: c.title,
        description: c.description,
        questions: c.questions ?? [],
        fields: c.fields ?? [],
        passmark: c.passmark,
        course_timer: c.course_timer,
        learnOutcomes: c.learn_outcomes,
        points_enabled: c.points_enabled,
        points_base: c.points_base,
        pointsSystem: { enabled: c.points_enabled ?? false, basePoints: c.points_base ?? 100 },
        postSubmission: c.post_submission,
        coverImage: c.cover_image,
        deadline_days: c.deadline_days,
        theme: c.theme,
        mode: c.mode,
        font: c.font,
        customAccent: c.custom_accent,
      },
    };
  } else if (type === 'virtual_experience') {
    const { data: v, error } = await db.from('virtual_experiences').select('*').eq('id', id).eq('user_id', user.id).single();
    if (error || !v) return NextResponse.json({ error: 'Virtual experience not found' }, { status: 404 });
    payload = {
      exportVersion: 1,
      type: 'virtual_experience',
      title: v.title,
      exportedAt: new Date().toISOString(),
      config: {
        isVirtualExperience: true,
        title: v.title,
        description: v.description,
        modules: v.modules ?? [],
        industry: v.industry,
        difficulty: v.difficulty,
        role: v.role,
        company: v.company,
        duration: v.duration,
        tools: v.tools ?? [],
        tagline: v.tagline,
        background: v.background,
        learnOutcomes: v.learn_outcomes,
        managerName: v.manager_name,
        managerTitle: v.manager_title,
        dataset: v.dataset,
        coverImage: v.cover_image,
        deadline_days: v.deadline_days,
        theme: v.theme,
        mode: v.mode,
        font: v.font,
        customAccent: v.custom_accent,
      },
    };
  } else if (type === 'assignment') {
    const { data: a, error: aErr } = await db.from('assignments').select('*').eq('id', id).eq('created_by', user.id).single();
    if (aErr || !a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    const { data: resources } = await db
      .from('assignment_resources')
      .select('name, url, resource_type')
      .eq('assignment_id', id);
    payload = {
      exportVersion: 1,
      type: 'assignment',
      title: a.title,
      exportedAt: new Date().toISOString(),
      data: {
        title: a.title,
        scenario: a.scenario ?? null,
        brief: a.brief ?? null,
        tasks: a.tasks ?? null,
        requirements: a.requirements ?? null,
        submission_instructions: a.submission_instructions ?? null,
        cover_image: a.cover_image ?? null,
        type: a.type ?? null,
        config: a.config ?? null,
      },
      resources: (resources ?? []).map((r: any) => ({ name: r.name, url: r.url, resource_type: r.resource_type })),
    };
  } else {
    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  }

  try {
    const bodyString = JSON.stringify({ payload });
    const timestamp   = Date.now().toString();
    const signature   = createHmac('sha256', syncKey).update(`${timestamp}.${bodyString}`).digest('hex');

    const res = await fetch(`${syncUrl}/api/sync-receive`, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Sync-Timestamp': timestamp,
        'X-Sync-Signature': signature,
      },
      body: bodyString,
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('[sync-push] non-JSON response from destination:', res.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `Destination returned ${res.status}. Is PLATFORM_SYNC_URL correct and is the other app running? (${syncUrl})` },
        { status: 502 }
      );
    }
    const result = await res.json();
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[sync-push]', err.message);
    return NextResponse.json({ error: `Could not reach destination platform. Check PLATFORM_SYNC_URL (${syncUrl}).` }, { status: 502 });
  }
}
