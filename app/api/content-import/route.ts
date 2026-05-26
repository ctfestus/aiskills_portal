import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/admin-client';
import { compareResults, SQLResult, SQLTableConfig } from '@/lib/sql-engine';
import { computeServerSqlResult } from '@/lib/sql-engine-server';

export const dynamic = 'force-dynamic';

function shortSlug() {
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

function splitOrderExpressions(orderByClause: string): string[] {
  const expressions: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;

  for (let i = 0; i < orderByClause.length; i += 1) {
    const ch = orderByClause[i];
    if (quote) {
      current += ch;
      if (ch === quote && orderByClause[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) expressions.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) expressions.push(current.trim());
  return expressions;
}

function getOrderByExpressions(sql: string): string[] {
  const compact = sql.replace(/\s+/g, ' ').trim();
  const match = compact.match(/\border\s+by\s+(.+?)(?:\blimit\b|\boffset\b|\bfetch\b|$)/i);
  return match ? splitOrderExpressions(match[1]) : [];
}

function hasAmbiguousLimit(sql: string) {
  if (!/\blimit\s+\d+\b/i.test(sql) || !/\border\s+by\b/i.test(sql)) return false;
  const expressions = getOrderByExpressions(sql);
  if (expressions.length >= 2) return false;
  return !/\b(id|_id|uuid|key)\b/i.test(expressions[0] ?? '');
}

async function preflightImportedCourseSql(cfg: any): Promise<{ config?: any; error?: string; issues?: string[] }> {
  const questions = Array.isArray(cfg?.questions) ? cfg.questions : [];
  const sqlQuestions = questions.filter((question: any) => question?.type === 'sql_exercise');
  if (!sqlQuestions.length) return { config: cfg };

  const tableMap = new Map<string, SQLTableConfig>();
  for (const question of sqlQuestions) {
    for (const table of question.sqlTables ?? []) {
      const key = `${table.tableName}|${table.fileUrl || table.csvUrl || table.seedSql || ''}`;
      if (table.tableName && !tableMap.has(key)) tableMap.set(key, table);
    }
  }
  const tables = Array.from(tableMap.values());
  const updatedQuestions = [...questions];
  const issues: string[] = [];

  for (let i = 0; i < updatedQuestions.length; i += 1) {
    const question = updatedQuestions[i];
    if (question?.type !== 'sql_exercise') continue;
    const label = question.id || question.question?.slice(0, 70) || `SQL exercise ${i + 1}`;

    if (!question.sqlSolution?.trim()) {
      issues.push(`${label}: missing solution query. Add a solution query so student answers can be validated.`);
      continue;
    }

    if (hasAmbiguousLimit(question.sqlSolution)) {
      issues.push(`${label}: solution uses LIMIT after ORDER BY without a clear tie-breaker. Add a stable secondary sort, such as an id column, then recompute the expected result.`);
      continue;
    }

    let recomputed: SQLResult;
    try {
      recomputed = await computeServerSqlResult(tables, question.sqlSolution);
    } catch (err: any) {
      issues.push(`${label}: solution query failed: ${err?.message || 'unknown SQL error'}`);
      continue;
    }

    if (!question.sqlExpectedResult) {
      updatedQuestions[i] = { ...question, sqlExpectedResult: recomputed };
      continue;
    }

    const comparison = compareResults(recomputed, question.sqlExpectedResult, {
      ordered: !!question.sqlResultOrdered,
      numericTolerance: Number(question.sqlNumericTolerance ?? 0),
    });
    if (!comparison.passed) {
      issues.push(`${label}: saved expected result does not match the current solution query. ${comparison.message} Recompute the expected result before importing.`);
    }
  }

  if (issues.length) {
    return { error: 'SQL exercise validation failed.', issues };
  }

  return { config: { ...cfg, questions: updatedQuestions } };
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
    let cfg = body.config;
    if (!cfg) return NextResponse.json({ error: 'config required' }, { status: 400 });

    const sqlPreflight = await preflightImportedCourseSql(cfg);
    if (sqlPreflight.error) {
      return NextResponse.json({ error: sqlPreflight.error, issues: sqlPreflight.issues }, { status: 400 });
    }
    cfg = sqlPreflight.config;

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
