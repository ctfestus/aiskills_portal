import { createClient } from '@supabase/supabase-js';

// Singleton — reused across warm serverless invocations, avoids re-allocating
// the client object on every request.
const _admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Service-role client. Use only for writes or auth verification — not for reads
 *  that RLS can already scope. */
export function adminClient() { return _admin; }

export const PLAN_LIMITS = {
  free:     { forms: 2,  events: 2,  courses: 0,  aiGenerations: 0,  responsesPerForm: 50, emails: 0  },
  pro:      { forms: -1, events: -1, courses: -1, aiGenerations: -1, responsesPerForm: -1, emails: -1 },
  business: { forms: -1, events: -1, courses: -1, aiGenerations: -1, responsesPerForm: -1, emails: -1 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

/** Read the creator's plan using their own JWT — RLS-scoped, no service role needed. */
export async function getCreatorPlan(userJwt: string): Promise<PlanId> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
      auth: { persistSession: false },
    }
  );
  const { data } = await client.from('profiles').select('plan').single();
  const plan = data?.plan as PlanId;
  return plan in PLAN_LIMITS ? plan : 'free';
}

export function getLimits(plan: PlanId) {
  return PLAN_LIMITS[plan];
}

export interface PlanLimits {
  forms: number;
  events: number;
  courses: number;
  aiGenerations: number;
  responsesPerForm: number;
  emails: number;
}

/**
 * Read the creator's live limits from plan_config (DB-driven).
 * Falls back to hardcoded PLAN_LIMITS if plan_config is not set up yet.
 * Two indexed PK lookups — always fresh, no module-level cache.
 */
export async function getCreatorLimits(userJwt: string): Promise<PlanLimits> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
      auth: { persistSession: false },
    }
  );

  const { data: profile } = await client.from('profiles').select('plan').single();
  const plan = String(profile?.plan || 'free');

  const { data: config } = await client
    .from('plan_config')
    .select('forms, events, courses, ai_generations, responses_per_form, emails')
    .eq('plan', plan)
    .single();

  if (!config) {
    // plan_config table not populated yet — fall back to hardcoded defaults
    return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.free;
  }

  return {
    forms:            config.forms            ?? -1,
    events:           config.events           ?? -1,
    courses:          config.courses          ?? -1,
    aiGenerations:    config.ai_generations   ?? -1,
    responsesPerForm: config.responses_per_form ?? -1,
    emails:           config.emails           ?? -1,
  };
}

/** Human-readable upgrade message returned to the frontend. */
export function limitMessage(resource: 'form' | 'event' | 'course' | 'aiGenerations'): string {
  const labels: Record<string, string> = {
    form: 'forms',
    event: 'events',
    course: 'courses',
    aiGenerations: 'AI generations',
  };
  return `You've reached the free plan limit for ${labels[resource]}. Upgrade to Pro for unlimited access.`;
}
