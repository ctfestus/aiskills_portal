import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Clamp a pagination param to a sane integer range before forwarding it upstream.
function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function GET(req: NextRequest) {
  // Authoring-only: this proxies Pexels on the server's API key, so it must not be an
  // open relay anyone can use to drain the quota. The cover-image picker is staff-only.
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const page = clampInt(req.nextUrl.searchParams.get('page'), 1, 1, 1000);
  const perPage = clampInt(req.nextUrl.searchParams.get('per_page'), 15, 1, 80);

  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 });

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Pexels API key not configured' }, { status: 500 });

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&orientation=landscape`;

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return NextResponse.json({ error: 'Pexels request failed' }, { status: res.status });

  const json = await res.json();

  const photos = (json.photos ?? []).map((p: any) => ({
    id: p.id,
    photographer: p.photographer,
    alt: p.alt,
    src: {
      medium: p.src.medium,
      large: p.src.large2x ?? p.src.large,
    },
  }));

  return NextResponse.json({ photos, total_results: json.total_results });
}
