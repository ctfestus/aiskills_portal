import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const page = req.nextUrl.searchParams.get('page') ?? '1';
  const perPage = req.nextUrl.searchParams.get('per_page') ?? '15';

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
