import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;
const API_KEY    = process.env.BUNNY_API_KEY!;
// Optional override -- if not set we auto-detect from the library info
const CDN_HOST   = process.env.BUNNY_CDN_HOSTNAME ?? '';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function verifyCreator(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user } } = await serviceClient().auth.getUser(auth.slice(7));
  if (!user) return null;

  const { data: profile } = await serviceClient()
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['instructor', 'admin'].includes(profile.role)) return null;

  return user.id;
}

// Cache the CDN hostname so we only fetch library info once per process
let cachedCdnHost = CDN_HOST;

async function getCdnHost(): Promise<string> {
  if (cachedCdnHost) return cachedCdnHost;
  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}`,
      { headers: { AccessKey: API_KEY, accept: 'application/json' } },
    );
    if (res.ok) {
      const json = await res.json();
      // PullZoneHostnames is an array -- use the first custom hostname or the b-cdn.net one
      const hostnames: string[] = json.PullZoneHostnames ?? [];
      const host = hostnames.find((h: string) => h.endsWith('.b-cdn.net')) ?? hostnames[0] ?? '';
      if (host) cachedCdnHost = host;
    }
  } catch {
    // fall through -- thumbnails will be null
  }
  return cachedCdnHost;
}

function thumbnailUrl(cdnHost: string, guid: string, fileName: string): string | null {
  if (!cdnHost) return null;
  const host = cdnHost.startsWith('http') ? cdnHost : `https://${cdnHost}`;
  return `${host}/${guid}/${fileName || 'thumbnail.jpg'}`;
}

// GET /api/bunny?page=1&search=intro&collection=guid
// GET /api/bunny?collections=1
export async function GET(req: NextRequest) {
  const userId = await verifyCreator(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!LIBRARY_ID || !API_KEY) {
    return NextResponse.json({ error: 'Bunny not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const cdnHost = await getCdnHost();

  // -- Collections list --
  if (searchParams.get('collections') === '1') {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/collections?page=1&itemsPerPage=100&orderBy=date`,
      { headers: { AccessKey: API_KEY, accept: 'application/json' } },
    );
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 502 });
    const json = await res.json();
    const collections = (json.items ?? []).map((c: any) => ({
      guid:       c.guid,
      name:       c.name || 'Untitled',
      videoCount: c.videoCount ?? 0,
    }));
    return NextResponse.json({ collections });
  }

  // -- Videos list --
  const page       = searchParams.get('page')       ?? '1';
  const search     = searchParams.get('search')     ?? '';
  const collection = searchParams.get('collection') ?? '';

  const qs = new URLSearchParams({
    page,
    itemsPerPage: '50',
    orderBy: 'date',
    ...(search     ? { search }     : {}),
    ...(collection ? { collection } : {}),
  });

  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos?${qs}`,
    { headers: { AccessKey: API_KEY, accept: 'application/json' } },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('[bunny] list error:', res.status, text);
    return NextResponse.json({ error: 'Failed to fetch videos from Bunny' }, { status: 502 });
  }

  const json = await res.json();

  const videos = (json.items ?? []).map((v: any) => {
    const thumb = thumbnailUrl(cdnHost, v.guid, v.thumbnailFileName ?? 'thumbnail.jpg');
    if (!thumb) console.warn('[bunny] no CDN host -- thumbnails disabled. Set BUNNY_CDN_HOSTNAME in .env');
    else if (json.items?.indexOf(v) === 0) console.log('[bunny] sample thumbnail URL:', thumb);
    return {
      guid:      v.guid,
      title:     v.title || 'Untitled',
      duration:  v.length ?? 0,
      status:    v.status,
      thumbnail: thumb,
      embedUrl:  `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${v.guid}?autoplay=false`,
    };
  });

  return NextResponse.json({
    videos,
    totalItems:  json.totalItems  ?? videos.length,
    currentPage: json.currentPage ?? 1,
  });
}
