import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function shortSlug() {
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export async function POST(req: NextRequest) {
  const syncKey = process.env.PLATFORM_SYNC_KEY;
  const ownerId = process.env.PLATFORM_SYNC_OWNER_ID;

  if (!syncKey || !ownerId)
    return NextResponse.json({ error: 'Sync not configured on this platform.' }, { status: 503 });

  const timestamp    = req.headers.get('x-sync-timestamp');
  const receivedSig  = req.headers.get('x-sync-signature');

  if (!timestamp || !receivedSig)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const age = Date.now() - Number(timestamp);
  if (isNaN(age) || age < 0 || age > TIMESTAMP_WINDOW_MS)
    return NextResponse.json({ error: 'Request expired' }, { status: 401 });

  const rawBody = await req.text();

  const expected = createHmac('sha256', syncKey).update(`${timestamp}.${rawBody}`).digest('hex');
  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { valid = false; }

  if (!valid)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = body.payload;
  if (!payload || payload.exportVersion !== 1)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const db     = adminClient();
  const userId = ownerId;
  const { type } = payload;

  // -- Course ---
  if (type === 'course') {
    const cfg   = payload.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });
    const title = payload.title || cfg.title || 'Synced Course';

    const { data: existing } = await db
      .from('courses').select('id, slug').eq('user_id', userId).eq('title', title).maybeSingle();

    if (existing) {
      const { error: upErr } = await db.from('courses').update({
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
        console.error('[sync-receive] course update:', upErr.message);
        return NextResponse.json({ error: 'Failed to update course.' }, { status: 500 });
      }
      return NextResponse.json({ id: existing.id, slug: existing.slug, type: 'course', action: 'updated' });
    }

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await db.from('courses').insert({
        user_id:         userId,
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
      console.error('[sync-receive] course:', error.message);
      return NextResponse.json({ error: 'Failed to sync course.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not generate unique slug.' }, { status: 409 });
  }

  // -- Virtual Experience ---
  if (type === 'virtual_experience') {
    const cfg   = payload.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });
    const title = payload.title || cfg.title || 'Synced Virtual Experience';

    const { data: existing } = await db
      .from('virtual_experiences').select('id, slug').eq('user_id', userId).eq('title', title).maybeSingle();

    if (existing) {
      const { error: upErr } = await db.from('virtual_experiences').update({
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
        console.error('[sync-receive] VE update:', upErr.message);
        return NextResponse.json({ error: 'Failed to update virtual experience.' }, { status: 500 });
      }
      return NextResponse.json({ id: existing.id, slug: existing.slug, type: 'virtual_experience', action: 'updated' });
    }

    let attempt = 0, slug = shortSlug();
    while (attempt < 3) {
      if (attempt > 0) slug = shortSlug();
      const { data, error } = await db.from('virtual_experiences').insert({
        user_id:        userId,
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
      console.error('[sync-receive] VE:', error.message);
      return NextResponse.json({ error: 'Failed to sync virtual experience.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not generate unique slug.' }, { status: 409 });
  }

  // -- Assignment ---
  if (type === 'assignment') {
    const d = payload.data;
    if (!d) return NextResponse.json({ error: 'data required' }, { status: 400 });
    const title     = d.title || 'Synced Assignment';
    const resources: any[] = payload.resources ?? [];

    const { data: existing } = await db
      .from('assignments').select('id').eq('created_by', userId).eq('title', title).maybeSingle();

    if (existing) {
      // Capture old resource IDs before touching anything
      const { data: oldRows } = await db
        .from('assignment_resources').select('id').eq('assignment_id', existing.id);
      const oldIds = (oldRows ?? []).map((r: any) => r.id);

      const { error: upErr } = await db.from('assignments').update({
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
        console.error('[sync-receive] assignment update:', upErr.message);
        return NextResponse.json({ error: 'Failed to update assignment.' }, { status: 500 });
      }

      // Insert new resources before deleting old ones
      if (resources.length) {
        const { error: insErr } = await db.from('assignment_resources').insert(
          resources.map(r => ({ assignment_id: existing.id, name: r.name, url: r.url, resource_type: r.resource_type || 'link' }))
        );
        if (insErr) {
          console.error('[sync-receive] resource insert:', insErr.message);
          return NextResponse.json({ error: 'Failed to update assignment resources.' }, { status: 500 });
        }
      }

      // Now delete only the previously captured IDs
      if (oldIds.length) {
        await db.from('assignment_resources').delete().in('id', oldIds);
      }

      return NextResponse.json({ id: existing.id, type: 'assignment', action: 'updated' });
    }

    const { data: assignment, error: aErr } = await db.from('assignments').insert({
      created_by:              userId,
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
      console.error('[sync-receive] assignment:', aErr.message);
      return NextResponse.json({ error: 'Failed to sync assignment.' }, { status: 500 });
    }

    if (resources.length) {
      await db.from('assignment_resources').insert(
        resources.map(r => ({ assignment_id: assignment.id, name: r.name, url: r.url, resource_type: r.resource_type || 'link' }))
      );
    }
    return NextResponse.json({ id: assignment.id, type: 'assignment', action: 'created' });
  }

  return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
}
