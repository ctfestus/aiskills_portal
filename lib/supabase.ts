import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton -- prevents multiple instances competing for the same Web Lock
// when the module is evaluated more than once (e.g. hot reload, multiple tabs).
// `auth.lock` is set to a no-op so the Web Locks API is never used,
// which eliminates the "Lock broken by another request with the 'steal' option" AbortError.
const createSingletonClient = () =>
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
    },
  });

declare global {
  // eslint-disable-next-line no-var
  var _supabaseClient: ReturnType<typeof createSingletonClient> | undefined;
}

export const supabase =
  globalThis._supabaseClient ?? (globalThis._supabaseClient = createSingletonClient());
