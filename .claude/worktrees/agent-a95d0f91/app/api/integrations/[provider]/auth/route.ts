import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const APP_URL = process.env.APP_URL || 'https://festforms.com';

const OAUTH: Record<string, { authUrl: string; scope?: string; clientId: string; extras?: Record<string, string> }> = {
  google_meet: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/calendar.events email',
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    extras: { access_type: 'offline', prompt: 'consent' },
  },
  zoom: {
    authUrl: 'https://zoom.us/oauth/authorize',
    clientId: process.env.ZOOM_CLIENT_ID ?? '',
  },
  teams: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scope: 'https://graph.microsoft.com/OnlineMeetings.ReadWrite offline_access email',
    clientId: process.env.TEAMS_CLIENT_ID ?? '',
    extras: { response_mode: 'query' },
  },
};

// Signs { userId, ts } into a tamper-proof state string.
function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const cfg = OAUTH[provider];
  if (!cfg) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  if (!cfg.clientId) return NextResponse.json({ error: `${provider} client ID not configured` }, { status: 503 });

  // Read token from Authorization header — never from a URL parameter.
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = auth.slice(7);

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = signState(user.id);
  const redirectUri = `${APP_URL}/api/integrations/${provider}/callback`;

  const url = new URL(cfg.authUrl);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  if (cfg.scope) url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);
  for (const [k, v] of Object.entries(cfg.extras ?? {})) url.searchParams.set(k, v);

  // Return the OAuth URL as JSON — client navigates, keeping the bearer token out of URLs.
  return NextResponse.json({ url: url.toString() });
}
