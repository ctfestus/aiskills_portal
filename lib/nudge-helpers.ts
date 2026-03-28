/**
 * Shared helpers for tracking and sending automated nudge emails.
 */

/**
 * Returns true if a nudge of this type was already sent within the given window.
 * Pass withinDays = undefined for a lifetime check (milestone_80).
 */
export async function hasNudgeBeenSent(
  supabase: any,
  studentEmail: string,
  formId: string | null,
  nudgeType: string,
  withinDays?: number,
): Promise<boolean> {
  let query = supabase
    .from('sent_nudges')
    .select('id')
    .eq('student_email', studentEmail.toLowerCase().trim())
    .eq('nudge_type', nudgeType);

  if (formId) query = query.eq('form_id', formId);

  if (withinDays !== undefined) {
    const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('sent_at', since);
  }

  const { data } = await query.limit(1).maybeSingle();
  return !!data;
}

/** Records that a nudge was sent. */
export async function recordNudge(
  supabase: any,
  studentEmail: string,
  formId: string | null,
  nudgeType: string,
): Promise<void> {
  await supabase.from('sent_nudges').insert({
    student_email: studentEmail.toLowerCase().trim(),
    form_id:       formId ?? null,
    nudge_type:    nudgeType,
  });
}

/** Computes total requirements across all modules/lessons in a virtual experience config. */
export function totalRequirements(config: any): number {
  let total = 0;
  for (const mod of config?.modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      total += (lesson.requirements ?? []).length;
    }
  }
  return total;
}

/** Counts completed requirements in a progress object. */
export function completedRequirements(progress: any): number {
  if (!progress || typeof progress !== 'object') return 0;
  return Object.values(progress).filter((v: any) => v?.completed).length;
}
