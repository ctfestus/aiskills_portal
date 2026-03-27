import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// -- Token refresh helpers ---
async function refreshGoogle(refreshToken: string): Promise<string | null> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
  });
  return (await r.json()).access_token ?? null;
}

async function refreshZoom(refreshToken: string): Promise<string | null> {
  const creds = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  return (await r.json()).access_token ?? null;
}

async function refreshTeams(refreshToken: string): Promise<string | null> {
  const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: process.env.TEAMS_CLIENT_ID!, client_secret: process.env.TEAMS_CLIENT_SECRET!, scope: 'https://graph.microsoft.com/OnlineMeetings.ReadWrite offline_access' }),
  });
  return (await r.json()).access_token ?? null;
}

async function getValidToken(integration: any, provider: string): Promise<string | null> {
  const expired = integration.token_expiry && new Date(integration.token_expiry) < new Date(Date.now() + 60_000);
  if (!expired) return integration.access_token;
  if (!integration.refresh_token) return null;

  let newToken: string | null = null;
  if (provider === 'google_meet') newToken = await refreshGoogle(integration.refresh_token);
  else if (provider === 'zoom')   newToken = await refreshZoom(integration.refresh_token);
  else if (provider === 'teams')  newToken = await refreshTeams(integration.refresh_token);

  if (newToken) {
    await adminSupabase.from('user_integrations').update({
      access_token: newToken,
      token_expiry: new Date(Date.now() + 3_600_000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', integration.user_id).eq('provider', provider);
  }
  return newToken;
}

// -- Meeting creators ---
async function createGoogleMeet(token: string, title: string, startIso: string): Promise<string> {
  const start = new Date(startIso);
  const end   = new Date(start.getTime() + 3_600_000);
  const r = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end:   { dateTime: end.toISOString(),   timeZone: 'UTC' },
        conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    }
  );
  const d = await r.json();
  const link = d.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
  if (!link) throw new Error(d.error?.message || 'No Meet link returned');
  return link;
}

async function createZoomMeeting(token: string, title: string, startIso: string): Promise<string> {
  const r = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: title, type: 2, start_time: new Date(startIso).toISOString(), duration: 60, settings: { join_before_host: true, waiting_room: false } }),
  });
  const d = await r.json();
  if (!d.join_url) throw new Error(d.message || 'No Zoom join URL returned');
  return d.join_url;
}

async function createTeamsMeeting(token: string, title: string, startIso: string): Promise<string> {
  const start = new Date(startIso);
  const end   = new Date(start.getTime() + 3_600_000);
  const r = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: title, startDateTime: start.toISOString(), endDateTime: end.toISOString() }),
  });
  const d = await r.json();
  if (!d.joinWebUrl) throw new Error(d.error?.message || 'No Teams join URL returned');
  return d.joinWebUrl;
}

// -- Auth helper ---
async function getCallerUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user.id;
}

// -- Handler ---
export async function POST(req: NextRequest) {
  try {
    const userId = await getCallerUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider, title, startTime } = await req.json();
    if (!provider) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const { data: integration, error } = await adminSupabase
      .from('user_integrations').select('*').eq('user_id', userId).eq('provider', provider).single();

    if (error || !integration)
      return NextResponse.json({ error: 'Integration not found. Please reconnect.' }, { status: 404 });

    const token = await getValidToken(integration, provider);
    if (!token)
      return NextResponse.json({ error: 'Session expired. Please reconnect your account.' }, { status: 401 });

    const safeStart = startTime || new Date(Date.now() + 86_400_000).toISOString();
    let url: string;
    if      (provider === 'google_meet') url = await createGoogleMeet(token, title || 'Event', safeStart);
    else if (provider === 'zoom')        url = await createZoomMeeting(token, title || 'Event', safeStart);
    else if (provider === 'teams')       url = await createTeamsMeeting(token, title || 'Event', safeStart);
    else return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create meeting' }, { status: 500 });
  }
}
