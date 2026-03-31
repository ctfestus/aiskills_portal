/**
 * POST /api/cohort-assignments
 * Upserts rows in cohort_assignments for the given form + cohort list.
 * Uses INSERT ... ON CONFLICT DO NOTHING so the original assigned_at is preserved
 * when cohorts are re-added after being removed.
 * Sends assignment notification emails only to cohorts that are newly added.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/subscription';
import { sendAssignmentNotifications } from '@/lib/send-assignment-notification';

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

  // Verify the form belongs to this user and get title/slug for notifications
  const { data: form } = await supabase
    .from('forms')
    .select('id, title, slug, content_type')
    .eq('id', formId)
    .eq('user_id', user.id)
    .single();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  // Fetch currently assigned cohorts so we can detect newly added ones
  const { data: existing } = await supabase
    .from('cohort_assignments')
    .select('cohort_id')
    .eq('form_id', formId);

  const existingSet = new Set((existing ?? []).map((r: { cohort_id: string }) => r.cohort_id));
  const newCohortIds = cohortIds.filter((id: string) => !existingSet.has(id));

  // Upsert -- ON CONFLICT DO NOTHING preserves the original assigned_at
  const rows = cohortIds.map((cohortId: string) => ({ form_id: formId, cohort_id: cohortId }));
  const { error } = await supabase
    .from('cohort_assignments')
    .upsert(rows, { onConflict: 'form_id,cohort_id', ignoreDuplicates: true });

  if (error) {
    console.error('[cohort-assignments] upsert error:', error);
    return NextResponse.json({ error: 'Failed to save cohort assignments.' }, { status: 500 });
  }

  // Send notifications to newly assigned cohorts (includes re-assignments after removal)
  if (newCohortIds.length > 0 && form.slug) {
    sendAssignmentNotifications({
      cohortIds: newCohortIds,
      title: form.title,
      slug: form.slug,
      contentType: form.content_type ?? 'course',
    });
  }

  return NextResponse.json({ ok: true });
}
