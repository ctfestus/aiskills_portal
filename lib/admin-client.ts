import { createClient } from '@supabase/supabase-js';

// Singleton -- reused across warm serverless invocations
const _admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Service-role client. Use only for writes or auth verification -- not for reads that RLS can already scope. */
export function adminClient() { return _admin; }
