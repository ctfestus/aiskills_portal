import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

function shortSlug() {
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  if (!student || !['instructor', 'admin'].includes(student.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { exportVersion, type } = body;
  if (exportVersion !== 1)
    return NextResponse.json({ error: 'Unsupported export version' }, { status: 400 });
  if (!['course', 'virtual_experience', 'assignment'].includes(type))
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  // -- Course ---
  if (type === 'course') {
    const cfg = body.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await supabase.from('courses').insert({
        user_id:         user.id,
        title:           body.title || cfg.title || 'Imported Course',
        slug,
        description:     cfg.description ?? null,
        status:          'draft',
        cohort_ids:      [],
        cover_image:     cfg.coverImage ?? null,
        deadline_days:   cfg.deadline_days ?? null,
        theme:           cfg.theme ?? null,
        mode:            cfg.mode ?? null,
        font:            cfg.font ?? null,
        custom_accent:   cfg.customAccent ?? null,
        questions:       cfg.questions ?? [],
        fields:          cfg.fields ?? [],
        passmark:        cfg.passmark ?? 50,
        course_timer:    cfg.courseTimer ?? cfg.course_timer ?? null,
        learn_outcomes:  cfg.learnOutcomes ?? [],
        points_enabled:  cfg.pointsSystem?.enabled ?? cfg.points_enabled ?? true,
        points_base:     cfg.pointsSystem?.basePoints ?? cfg.points_base ?? 50,
        post_submission: cfg.postSubmission ?? null,
      }).select('id, slug').single();
      if (!error) return NextResponse.json({ id: data.id, slug: data.slug, type: 'course' });
      if (error.code === '23505') { attempt++; continue; }
      console.error('[content-import] course:', error.message);
      return NextResponse.json({ error: 'Failed to import course.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not generate unique slug.' }, { status: 409 });
  }

  // -- Virtual Experience ---
  if (type === 'virtual_experience') {
    const cfg = body.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await supabase.from('virtual_experiences').insert({
        user_id:        user.id,
        title:          body.title || cfg.title || 'Imported Virtual Experience',
        slug,
        description:    cfg.description ?? null,
        status:         'draft',
        cohort_ids:     [],
        industry:       cfg.industry ?? null,
        difficulty:     cfg.difficulty ?? null,
        role:           cfg.role ?? null,
        company:        cfg.company ?? null,
        duration:       cfg.duration ?? null,
        tools:          cfg.tools ?? [],
        tagline:        cfg.tagline ?? null,
        background:     cfg.background ?? null,
        learn_outcomes: cfg.learnOutcomes ?? [],
        manager_name:   cfg.managerName ?? null,
        manager_title:  cfg.managerTitle ?? null,
        modules:        cfg.modules ?? [],
        dataset:        cfg.dataset ?? null,
        cover_image:    cfg.coverImage ?? null,
        deadline_days:  cfg.deadline_days ?? null,
        theme:          cfg.theme ?? null,
        mode:           cfg.mode ?? null,
        font:           cfg.font ?? null,
        custom_accent:  cfg.customAccent ?? null,
      }).select('id, slug').single();
      if (!error) return NextResponse.json({ id: data.id, slug: data.slug, type: 'virtual_experience' });
      if (error.code === '23505') { attempt++; continue; }
      console.error('[content-import] VE:', error.message);
      return NextResponse.json({ error: 'Failed to import virtual experience.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not generate unique slug.' }, { status: 409 });
  }

  // -- Assignment ---
  if (type === 'assignment') {
    const d = body.data;
    if (!d) return NextResponse.json({ error: 'data required' }, { status: 400 });

    const { data: assignment, error: aErr } = await supabase.from('assignments').insert({
      created_by:              user.id,
      title:                   d.title || 'Imported Assignment',
      scenario:                d.scenario ?? null,
      brief:                   d.brief ?? null,
      tasks:                   d.tasks ?? null,
      requirements:            d.requirements ?? null,
      submission_instructions: d.submission_instructions ?? null,
      cover_image:             d.cover_image ?? null,
      status:                  'draft',
      cohort_ids:              [],
      deadline_date:           null,
      type:                    d.type ?? null,
      config:                  d.config ?? null,
    }).select('id').single();

    if (aErr) {
      console.error('[content-import] assignment:', aErr.message);
      return NextResponse.json({ error: 'Failed to import assignment.' }, { status: 500 });
    }

    const resources: any[] = body.resources ?? [];
    if (resources.length) {
      await supabase.from('assignment_resources').insert(
        resources.map(r => ({
          assignment_id: assignment.id,
          name:          r.name,
          url:           r.url,
          resource_type: r.resource_type || 'link',
        }))
      );
    }

    return NextResponse.json({ id: assignment.id, type: 'assignment' });
  }

  return NextResponse.json({ error: 'Unhandled type' }, { status: 400 });
}
