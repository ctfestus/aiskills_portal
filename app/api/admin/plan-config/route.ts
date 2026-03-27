import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const VALID_PLANS = ['free', 'pro', 'business'] as const;
const LIMIT_KEYS = ['forms', 'events', 'courses', 'ai_generations', 'responses_per_form', 'emails'] as const;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing service role key');
  return createClient(url, key);
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);

  const supabase = serviceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

// GET /api/admin/plan-config -- returns all plan limits
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data, error } = await serviceClient()
    .from('plan_config')
    .select('*')
    .order('plan');

  if (error) {
    console.error('[plan-config] GET:', error.message);
    return NextResponse.json({ error: 'Failed to load plan config' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// PATCH /api/admin/plan-config -- update one plan's limits
// Body: { plan: 'free'|'pro'|'business', forms?: number, events?: number, ... }
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { plan, ...updates } = body;

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan. Must be free, pro, or business.' }, { status: 400 });
  }

  // Validate + sanitize each limit field: must be integer >= -1
  const patch: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    if (!(key in updates)) continue;
    const val = updates[key];
    if (!Number.isInteger(val) || val < -1) {
      return NextResponse.json(
        { error: `Invalid value for "${key}": must be an integer >= -1 (-1 means unlimited).` },
        { status: 400 }
      );
    }
    patch[key] = val;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await serviceClient()
    .from('plan_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('plan', plan);

  if (error) {
    console.error('[plan-config] PATCH:', error.message);
    return NextResponse.json({ error: 'Failed to update plan config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
