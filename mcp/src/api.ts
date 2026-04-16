import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API_URL      = process.env.MCP_API_URL      ?? '';
const SUPABASE_URL = process.env.MCP_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.MCP_SUPABASE_ANON_KEY ?? '';
const EMAIL        = process.env.MCP_EMAIL        ?? '';
const PASSWORD     = process.env.MCP_PASSWORD     ?? '';

let supabase: SupabaseClient | null = null;
let sessionToken: string | null = null;

// Sign in once at startup and refresh when needed
export async function getToken(): Promise<string> {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('MCP_SUPABASE_URL and MCP_SUPABASE_ANON_KEY are required');
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  if (sessionToken) {
    // Verify token is still valid
    const { data: { user } } = await supabase.auth.getUser(sessionToken);
    if (user) return sessionToken;
  }

  if (!EMAIL || !PASSWORD) throw new Error('MCP_EMAIL and MCP_PASSWORD are required');

  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) throw new Error(`Authentication failed: ${error?.message}`);

  sessionToken = data.session.access_token;
  return sessionToken;
}

// Generic API call helper
export async function apiCall(path: string, body?: object, method = 'POST') {
  const token = await getToken();
  if (!API_URL) throw new Error('MCP_API_URL is not set -- add it to your MCP env config (e.g. https://learn.festman.com or https://app.aiskillsafrica.com)');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error ?? `API error ${res.status}`);
  }

  return json;
}

export async function apiGet(path: string) {
  return apiCall(path, undefined, 'GET');
}

// Query Supabase directly for tables with no dedicated API endpoint
export async function supabaseQuery(table: string, select = '*') {
  const token = await getToken();
  if (!supabase) throw new Error('Supabase client not initialized');

  // Set session so RLS applies as the logged-in instructor
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });

  const { data, error } = await supabase.from(table).select(select).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Run any arbitrary Supabase operation with the authenticated session
export async function supabaseRun(fn: (sb: SupabaseClient) => PromiseLike<{ data: any; error: any }>) {
  const token = await getToken();
  if (!supabase) throw new Error('Supabase client not initialized');
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  const { data, error } = await fn(supabase);
  if (error) throw new Error(error.message);
  return data;
}

// Return the authenticated client + current user ID -- used for direct DB writes that need user_id
export async function getAuthenticatedClient(): Promise<{ sb: SupabaseClient; userId: string }> {
  const token = await getToken();
  if (!supabase) throw new Error('Supabase client not initialized');
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Not authenticated');
  return { sb: supabase, userId: user.id };
}
