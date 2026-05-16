import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  isAllowedDatasetContentType,
  normalizeContentType,
  validatePublicDatasetUrl,
} from '@/lib/dataset-url-safety';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB hard cap
const TIMEOUT_MS = 30_000;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Only allow URLs that exist as a published dataset's file_url in the DB.
// This prevents SSRF: no arbitrary URL can be proxied.
async function isAllowedUrl(url: string): Promise<boolean> {
  const { data } = await adminClient()
    .from('data_center_datasets')
    .select('id')
    .eq('file_url', url)
    .eq('is_published', true)
    .maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  const urlCheck = await validatePublicDatasetUrl(url);
  if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });

  // Allowlist check - must be a published dataset's file_url
  const allowed = await isAllowedUrl(url);
  if (!allowed) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'error',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 });
    }

    // Reject based on Content-Length before reading body
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 });
    }

    // Stream body with a hard byte cap
    const reader = upstream.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'No response body' }, { status: 502 });

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_BYTES) {
        reader.cancel();
        return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 });
      }
      chunks.push(value);
    }

    const body = Buffer.concat(chunks);
    const contentType = normalizeContentType(upstream.headers.get('content-type'));
    if (!isAllowedDatasetContentType(contentType)) {
      return NextResponse.json({ error: 'Unsupported dataset content type' }, { status: 415 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 });
  }
}
