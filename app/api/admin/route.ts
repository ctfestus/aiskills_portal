import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -- Rate limiting ---
// Limits per admin per hour: 5 deletes, 20 suspend/unsuspend.
// In-memory -- resets on deploy. Sufficient to slow down a compromised session.
const adminRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkAdminRateLimit(adminId: string, action: string): boolean {
  const key = `${adminId}:${action}`;
  const limit = action === 'delete' ? 5 : 20;
  const now = Date.now();
  const entry = adminRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    adminRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// -- Audit logging ---
async function auditLog(
  supabase: ReturnType<typeof serviceClient>,
  adminId: string,
  action: string,
  targetId: string,
) {
  const entry = { admin_id: adminId, action, target_id: targetId, created_at: new Date().toISOString() };
  // Always write to server logs (captured by hosting provider).
  console.log('[ADMIN AUDIT]', JSON.stringify(entry));
  // Best-effort DB write -- table may not exist in all environments.
  try { await supabase.from('admin_audit_log').insert(entry); } catch { /* no-op */ }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing service role key');
  return createClient(url, key);
}

// Verify the request comes from an authenticated admin
async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabase = serviceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user.id : null;
}

// Validate creator_id and ensure the target is not an admin
async function resolveCreator(
  supabase: ReturnType<typeof serviceClient>,
  creator_id: unknown,
  adminId: string,
): Promise<{ error: NextResponse } | { role: string }> {
  if (!creator_id || typeof creator_id !== 'string') {
    return { error: NextResponse.json({ error: 'creator_id required' }, { status: 400 }) };
  }
  if (!UUID_RE.test(creator_id)) {
    return { error: NextResponse.json({ error: 'Invalid creator_id' }, { status: 400 }) };
  }
  if (creator_id === adminId) {
    return { error: NextResponse.json({ error: 'Cannot target yourself' }, { status: 400 }) };
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', creator_id)
    .single();

  if (target?.role === 'admin') {
    return { error: NextResponse.json({ error: 'Cannot target another admin' }, { status: 403 }) };
  }

  return { role: target?.role ?? 'creator' };
}

// POST /api/admin
export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = serviceClient();
  const { action, creator_id } = body;

  // -- Suspend creator ---
  if (action === 'suspend') {
    if (!checkAdminRateLimit(adminId, 'suspend')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Max 20 suspensions per hour.' }, { status: 429 });
    }
    const check = await resolveCreator(supabase, creator_id, adminId);
    if ('error' in check) return check.error;

    const { error } = await supabase
      .from('profiles')
      .update({ suspended: true })
      .eq('id', creator_id);

    if (error) { console.error('[admin] suspend:', error.message); return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 }); }
    await auditLog(supabase, adminId, 'suspend', creator_id as string);
    return NextResponse.json({ ok: true });
  }

  // -- Unsuspend creator ---
  if (action === 'unsuspend') {
    if (!checkAdminRateLimit(adminId, 'unsuspend')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Max 20 unsuspensions per hour.' }, { status: 429 });
    }
    const check = await resolveCreator(supabase, creator_id, adminId);
    if ('error' in check) return check.error;

    const { error } = await supabase
      .from('profiles')
      .update({ suspended: false })
      .eq('id', creator_id);

    if (error) { console.error('[admin] unsuspend:', error.message); return NextResponse.json({ error: 'Failed to unsuspend user' }, { status: 500 }); }
    await auditLog(supabase, adminId, 'unsuspend', creator_id as string);
    return NextResponse.json({ ok: true });
  }

  // -- Delete creator ---
  if (action === 'delete') {
    if (!checkAdminRateLimit(adminId, 'delete')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Max 5 deletions per hour.' }, { status: 429 });
    }
    const check = await resolveCreator(supabase, creator_id, adminId);
    if ('error' in check) return check.error;

    await auditLog(supabase, adminId, 'delete', creator_id as string);
    // Deleting the auth user cascades to profiles + forms (if FK set up)
    const { error } = await supabase.auth.admin.deleteUser(creator_id as string);
    if (error) { console.error('[admin] delete:', error.message); return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// GET /api/admin?action=stats|creators
export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = serviceClient();
  const action = req.nextUrl.searchParams.get('action');

  // -- Creator list ---
  if (action === 'creators') {
    const { data, error } = await supabase
      .from('creator_stats')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[admin] creators:', error.message); return NextResponse.json({ error: 'Failed to load creators' }, { status: 500 }); }
    return NextResponse.json(data ?? []);
  }

  // -- Stats ---
  const [creatorsRes, formsRes, responsesRes, certsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator'),
    supabase.from('forms').select('id', { count: 'exact', head: true }),
    supabase.from('responses').select('id', { count: 'exact', head: true }),
    supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('revoked', false),
  ]);

  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const { count: responsesThisMonth } = await supabase
    .from('responses')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  return NextResponse.json({
    creators:           creatorsRes.count ?? 0,
    forms:              formsRes.count ?? 0,
    responses:          responsesRes.count ?? 0,
    certificates:       certsRes.count ?? 0,
    responsesThisMonth: responsesThisMonth ?? 0,
  });
}
