/**
 * POST /api/cohort-assignments
 * Upserts rows in cohort_assignments for the given form + cohort list.
 * Uses INSERT ... ON CONFLICT DO NOTHING so the original assigned_at is preserved
 * when cohorts are re-added after being removed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { formId, cohortIds } = body;
  if (!formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  if (!Array.isArray(cohortIds) || !cohortIds.length) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  // Verify the form belongs to this user
  const { data: form } = await supabase
    .from('forms')
    .select('id')
    .eq('id', formId)
    .eq('user_id', user.id)
    .single();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  // Upsert -- ON CONFLICT DO NOTHING preserves the original assigned_at
  const rows = cohortIds.map((cohortId: string) => ({ form_id: formId, cohort_id: cohortId }));
  const { error } = await supabase
    .from('cohort_assignments')
    .upsert(rows, { onConflict: 'form_id,cohort_id', ignoreDuplicates: true });

  if (error) {
    console.error('[cohort-assignments] upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
