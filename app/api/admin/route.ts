import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing service role key');
  return createClient(url, key);
}

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabase = serviceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: student } = await supabase
    .from('students')
    .select('role')
    .eq('id', user.id)
    .single();

  return student?.role === 'admin' ? user.id : null;
}

// GET /api/admin?action=stats|instructors
export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = serviceClient();
  const action = req.nextUrl.searchParams.get('action');

  // -- Instructor list ---
  if (action === 'instructors') {
    const { data, error } = await supabase
      .from('instructor_stats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { console.error('[admin] instructors:', error.message); return NextResponse.json({ error: 'Failed to load instructors' }, { status: 500 }); }
    return NextResponse.json(data ?? []);
  }

  // -- Stats ---
  const [instructorsRes, formsRes, responsesRes, certsRes] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('role', 'instructor'),
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
    instructors:        instructorsRes.count ?? 0,
    forms:              formsRes.count ?? 0,
    responses:          responsesRes.count ?? 0,
    certificates:       certsRes.count ?? 0,
    responsesThisMonth: responsesThisMonth ?? 0,
  });
}
