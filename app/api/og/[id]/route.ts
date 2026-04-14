import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Exact hostnames allowed as image sources.
const ALLOWED_HOSTS = new Set([
  'images.pexels.com',
]);

// Hostnames that must end with one of these suffixes (Supabase Storage).
// Using .endsWith() on the parsed .hostname prevents attacks like
// "images.pexels.com.attacker.com" that would fool a naive .includes() check.
const ALLOWED_SUFFIXES = ['.supabase.co', '.supabase.in'];

function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  // Only HTTPS -- never proxy plain-HTTP or other protocols.
  if (parsed.protocol !== 'https:') return false;
  const { hostname } = parsed;
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return ALLOWED_SUFFIXES.some(suffix => hostname.endsWith(suffix));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // cover_image is now a typed column on each content table
  const [{ data: course }, { data: event }, { data: ve }] = await Promise.all([
    supabase.from('courses').select('cover_image').eq('id', id).maybeSingle(),
    supabase.from('events').select('cover_image').eq('id', id).maybeSingle(),
    supabase.from('virtual_experiences').select('cover_image').eq('id', id).maybeSingle(),
  ]);

  const coverImage: string | undefined = course?.cover_image ?? event?.cover_image ?? ve?.cover_image;
  if (!coverImage) return new NextResponse(null, { status: 404 });

  // Base64 data URL -- no network fetch, no SSRF risk.
  const base64Match = coverImage.match(/^data:([a-zA-Z0-9+\-./]+);base64,(.+)$/);
  if (base64Match) {
    const buffer = Buffer.from(base64Match[2], 'base64');
    return new NextResponse(buffer, {
      headers: { 'Content-Type': base64Match[1], 'Cache-Control': 'public, max-age=3600' },
    });
  }

  // External URL -- only proxy if the hostname is on the allowlist.
  if (isAllowedImageUrl(coverImage)) {
    const res = await fetch(coverImage);
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
