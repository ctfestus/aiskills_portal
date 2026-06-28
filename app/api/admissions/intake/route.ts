/**
 * POST /api/admissions/intake
 *
 * Inbound webhook for automated bootcamp signups (Google Form -> Google Sheet ->
 * Apps Script -> this route). Authenticated with a shared secret in the
 * `x-intake-secret` header (set the same value in the script and in
 * INTAKE_WEBHOOK_SECRET). It maps the sheet row to a single admission and reuses the
 * exact same pipeline as the admin bulk-admit screen: enrollment + payment recorded,
 * student account provisioned into the cohort, setup/login email sent.
 *
 * Body (JSON):
 *   cohort            cohort name OR cohort id (uuid) -- set this in the script, one per intake
 *   email             required
 *   name | full_name  student's name
 *   amount_paid       optional, defaults to 0
 *   paid_at           optional ISO date (YYYY-MM-DD)
 *   payment_method    optional (e.g. "Mobile Money")
 *   payment_reference optional
 *   notes             optional
 *   total_fee         optional override (otherwise taken from cohort payment settings)
 *   payment_plan      optional: full | flexible | sponsored | waived
 *
 * The target cohort must already have payment settings (total fee, currency) and a
 * start date configured in the dashboard before signups arrive.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { adminClient } from '@/lib/admin-client';
import { admitStudents, type AdmitRow } from '@/lib/admit-students';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Resolve a cohort name or uuid to a cohort id. Names are matched case-insensitively;
 *  when several share a name, the most recent active cohort wins. */
async function resolveCohortId(db: ReturnType<typeof adminClient>, value: string): Promise<string | null> {
  const v = value.trim();
  if (!v) return null;
  if (UUID_RE.test(v)) {
    const { data } = await db.from('cohorts').select('id').eq('id', v).maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await db
    .from('cohorts')
    .select('id, status, created_at')
    .ilike('name', v)
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) return null;
  const active = data.find(c => c.status === 'active');
  return (active ?? data[0]).id;
}

export async function POST(req: NextRequest) {
  const secret = process.env.INTAKE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Intake webhook not configured on this platform.' }, { status: 503 });
  }
  if (!secretMatches(req.headers.get('x-intake-secret'), secret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cohortRef = String(body.cohort ?? body.cohortId ?? body.cohortName ?? '').trim();
  if (!cohortRef) {
    return NextResponse.json({ error: 'cohort (name or id) is required' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const db = adminClient();

  const cohortId = await resolveCohortId(db, cohortRef);
  if (!cohortId) {
    return NextResponse.json({ error: `Cohort not found: ${cohortRef}` }, { status: 404 });
  }

  const row: AdmitRow = {
    email,
    full_name:         body.full_name ?? body.name ?? null,
    total_fee:         body.total_fee ?? null,
    payment_plan:      body.payment_plan ?? null,
    amount_paid:       body.amount_paid ?? body.amount ?? body.payment ?? 0,
    paid_at:           body.paid_at ?? null,
    payment_method:    body.payment_method ?? null,
    payment_reference: body.payment_reference ?? body.reference ?? null,
    notes:             body.notes ?? null,
  };

  const result = await admitStudents(db, cohortId, [row]);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // The pipeline collects per-row failures instead of throwing. Surface a non-2xx so
  // the caller (and the Apps Script run log) flags the failure rather than silently
  // recording a "success" for a student who was never provisioned.
  if (result.provisioned === 0 && result.errors.length > 0) {
    return NextResponse.json({ error: result.errors[0].error, ...result }, { status: 422 });
  }

  return NextResponse.json({ ok: true, cohortId, ...result });
}
