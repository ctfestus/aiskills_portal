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

// Only these MIME types may be served -- prevents same-origin XSS via data URLs
// and content-type confusion from proxied responses.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const NOSNIFF = { 'X-Content-Type-Options': 'nosniff' };

function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;
  const { hostname } = parsed;
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return ALLOWED_SUFFIXES.some(suffix => hostname.endsWith(suffix));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Only serve cover images for published content -- prevents leaking draft/private metadata
  // via the unauthenticated OG endpoint.
  const [{ data: course }, { data: event }, { data: ve }] = await Promise.all([
    supabase.from('courses').select('cover_image').eq('id', id).eq('status', 'published').maybeSingle(),
    supabase.from('events').select('cover_image').eq('id', id).eq('status', 'published').maybeSingle(),
    supabase.from('virtual_experiences').select('cover_image').eq('id', id).eq('status', 'published').maybeSingle(),
  ]);

  const coverImage: string | undefined = course?.cover_image ?? event?.cover_image ?? ve?.cover_image;
  if (!coverImage) return new NextResponse(null, { status: 404, headers: NOSNIFF });

  // Base64 data URL -- validate MIME type before serving to prevent same-origin XSS.
  const base64Match = coverImage.match(/^data:([a-zA-Z0-9+\-./]+);base64,(.+)$/);
  if (base64Match) {
    const mimeType = base64Match[1].toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return new NextResponse(null, { status: 415, headers: NOSNIFF });
    }
    const buffer = Buffer.from(base64Match[2], 'base64');
    return new NextResponse(buffer, {
      headers: { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=3600', ...NOSNIFF },
    });
  }

  // External URL -- only proxy allowlisted hostnames.
  // redirect: 'error' prevents a redirect chain from an allowlisted host to an
  // untrusted destination bypassing the allowlist (soft SSRF path).
  if (isAllowedImageUrl(coverImage)) {
    let res: Response;
    try {
      res = await fetch(coverImage, { redirect: 'error' });
    } catch {
      return new NextResponse(null, { status: 404, headers: NOSNIFF });
    }
    if (!res.ok) return new NextResponse(null, { status: 404, headers: NOSNIFF });

    const contentType = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return new NextResponse(null, { status: 415, headers: NOSNIFF });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600', ...NOSNIFF },
    });
  }

  return new NextResponse(null, { status: 404, headers: NOSNIFF });
}
