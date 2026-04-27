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

  const importMode: 'create' | 'sync' = body.mode === 'sync' ? 'sync' : 'create';

  // -- Course ---
  if (type === 'course') {
    const cfg = body.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });

    const title = body.title || cfg.title || 'Imported Course';

    if (importMode === 'sync') {
      const { data: existing } = await supabase
        .from('courses').select('id, slug').eq('user_id', user.id).eq('title', title).maybeSingle();
      if (existing) {
        const { error: upErr } = await supabase.from('courses').update({
          description:     cfg.description ?? null,
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
        }).eq('id', existing.id);
        if (upErr) {
          console.error('[content-import] course update:', upErr.message);
          return NextResponse.json({ error: 'Failed to update course.' }, { status: 500 });
        }
        return NextResponse.json({ id: existing.id, slug: existing.slug, type: 'course', action: 'updated' });
      }
    }

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await supabase.from('courses').insert({
        user_id:         user.id,
        title,
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
      if (!error) return NextResponse.json({ id: data.id, slug: data.slug, type: 'course', action: 'created' });
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

    const title = body.title || cfg.title || 'Imported Virtual Experience';

    if (importMode === 'sync') {
      const { data: existing } = await supabase
        .from('virtual_experiences').select('id, slug').eq('user_id', user.id).eq('title', title).maybeSingle();
      if (existing) {
        const { error: upErr } = await supabase.from('virtual_experiences').update({
          description:    cfg.description ?? null,
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
        }).eq('id', existing.id);
        if (upErr) {
          console.error('[content-import] VE update:', upErr.message);
          return NextResponse.json({ error: 'Failed to update virtual experience.' }, { status: 500 });
        }
        return NextResponse.json({ id: existing.id, slug: existing.slug, type: 'virtual_experience', action: 'updated' });
      }
    }

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await supabase.from('virtual_experiences').insert({
        user_id:        user.id,
        title,
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
      if (!error) return NextResponse.json({ id: data.id, slug: data.slug, type: 'virtual_experience', action: 'created' });
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

    const title = d.title || 'Imported Assignment';
    const resources: any[] = body.resources ?? [];

    if (importMode === 'sync') {
      const { data: existing } = await supabase
        .from('assignments').select('id').eq('created_by', user.id).eq('title', title).maybeSingle();
      if (existing) {
        // Capture old resource IDs before touching anything
        const { data: oldRows } = await supabase
          .from('assignment_resources').select('id').eq('assignment_id', existing.id);
        const oldIds = (oldRows ?? []).map((r: any) => r.id);

        const { error: upErr } = await supabase.from('assignments').update({
          scenario:                d.scenario ?? null,
          brief:                   d.brief ?? null,
          tasks:                   d.tasks ?? null,
          requirements:            d.requirements ?? null,
          submission_instructions: d.submission_instructions ?? null,
          cover_image:             d.cover_image ?? null,
          type:                    d.type ?? null,
          config:                  d.config ?? null,
        }).eq('id', existing.id);
        if (upErr) {
          console.error('[content-import] assignment update:', upErr.message);
          return NextResponse.json({ error: 'Failed to update assignment.' }, { status: 500 });
        }

        // Insert new resources before deleting old ones
        if (resources.length) {
          const { error: insErr } = await supabase.from('assignment_resources').insert(
            resources.map(r => ({
              assignment_id: existing.id,
              name:          r.name,
              url:           r.url,
              resource_type: r.resource_type || 'link',
            }))
          );
          if (insErr) {
            console.error('[content-import] resource insert:', insErr.message);
            return NextResponse.json({ error: 'Failed to update assignment resources.' }, { status: 500 });
          }
        }

        // Now delete only the previously captured IDs
        if (oldIds.length) {
          await supabase.from('assignment_resources').delete().in('id', oldIds);
        }

        return NextResponse.json({ id: existing.id, type: 'assignment', action: 'updated' });
      }
    }

    const { data: assignment, error: aErr } = await supabase.from('assignments').insert({
      created_by:              user.id,
      title,
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

    return NextResponse.json({ id: assignment.id, type: 'assignment', action: 'created' });
  }

  return NextResponse.json({ error: 'Unhandled type' }, { status: 400 });
}
