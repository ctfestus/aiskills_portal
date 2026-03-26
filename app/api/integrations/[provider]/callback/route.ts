import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const APP_URL = process.env.APP_URL || 'https://festforms.com';

// ── State token burn register ─────────────────────────────────────────────────
// Prevents replay of a state token within its 5-minute validity window.
// In-memory: sufficient for single-instance deployments. For multi-instance /
// serverless, replace with a Redis SETNX or a `oauth_used_states` DB table.
const _usedStates  = new Set<string>();
const _stateExpiry = new Map<string, number>();

function burnState(state: string): boolean {
  if (_usedStates.has(state)) return false; // already exchanged — reject replay
  _usedStates.add(state);
  _stateExpiry.set(state, Date.now() + 10 * 60 * 1000); // keep entry for 10 min then prune
  // Prune expired entries to prevent unbounded memory growth.
  const now = Date.now();
  for (const [s, exp] of _stateExpiry) {
    if (now > exp) { _usedStates.delete(s); _stateExpiry.delete(s); }
  }
  return true;
}

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOKEN_CFG: Record<string, {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  getEmail: (token: string) => Promise<string | undefined>;
}> = {
  google_meet: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    getEmail: async (token) => {
      const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
      return (await r.json()).email;
    },
  },
  zoom: {
    tokenUrl: 'https://zoom.us/oauth/token',
    clientId: process.env.ZOOM_CLIENT_ID ?? '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? '',
    getEmail: async (token) => {
      const r = await fetch('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${token}` } });
      return (await r.json()).email;
    },
  },
  teams: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: process.env.TEAMS_CLIENT_ID ?? '',
    clientSecret: process.env.TEAMS_CLIENT_SECRET ?? '',
    getEmail: async (token) => {
      const r = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      return d.mail ?? d.userPrincipalName;
    },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const cfg = TOKEN_CFG[provider];
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  const fail = (reason: string) =>
    NextResponse.redirect(`${APP_URL}/dashboard?integration_error=${encodeURIComponent(reason)}#integrations`);

  if (oauthError || !code || !state || !cfg) return fail(provider);

  // Verify the HMAC signature on state — reject any forged/tampered state.
  let userId: string;
  try {
    const dot = state.lastIndexOf('.');
    if (dot === -1) return fail('invalid_state');
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
      .update(payload)
      .digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return fail('invalid_state');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!parsed.userId) return fail('invalid_state');

    // Enforce state TTL — reject if missing, non-finite, in the future beyond
    // clock skew (5s), or older than 5 minutes.
    const ts = parsed.ts;
    const now = Date.now();
    if (
      typeof ts !== 'number' ||
      !Number.isFinite(ts) ||
      ts > now + 5_000 ||
      now - ts > 5 * 60 * 1000
    ) return fail('invalid_state');

    // Burn the state token immediately — reject any replay within the window.
    if (!burnState(state)) return fail('state_already_used');

    userId = parsed.userId;
  } catch { return fail('invalid_state'); }
  const stateData = { userId };

  const redirectUri = `${APP_URL}/api/integrations/${provider}/callback`;

  const isZoom = provider === 'zoom';
  const tokenHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (isZoom) {
    tokenHeaders['Authorization'] = `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`;
  }
  const tokenBody: Record<string, string> = { grant_type: 'authorization_code', code, redirect_uri: redirectUri };
  if (!isZoom) { tokenBody.client_id = cfg.clientId; tokenBody.client_secret = cfg.clientSecret; }

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: tokenHeaders,
    body: new URLSearchParams(tokenBody),
  });
  const tokens = await tokenRes.json();
  if (tokens.error || !tokens.access_token) return fail(provider);

  const tokenExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  let accountEmail: string | undefined;
  try { accountEmail = await cfg.getEmail(tokens.access_token); } catch { /* best-effort */ }

  const { error: upsertErr } = await adminSupabase.from('meeting_integrations').upsert({
    user_id: stateData.userId,
    provider,
    connected: true,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expiry: tokenExpiry,
    email: accountEmail ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  if (upsertErr) return fail('save_failed');

  return NextResponse.redirect(`${APP_URL}/dashboard?integration_success=${encodeURIComponent(provider)}#integrations`);
}
