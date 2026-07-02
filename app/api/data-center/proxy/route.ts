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

function rawUrlToGitHubFile(rawUrl: string, owner: string, repo: string, fallbackBranch: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'raw.githubusercontent.com') return null;

  const parts = parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  if (parts[0] !== owner || parts[1] !== repo || parts.length < 4) return null;

  const rest = parts.slice(2);
  const fallbackParts = fallbackBranch.split('/').filter(Boolean);
  if (fallbackParts.length && rest.slice(0, fallbackParts.length).join('/') === fallbackBranch) {
    const pathParts = rest.slice(fallbackParts.length);
    if (!pathParts.length || pathParts.some(part => part === '..' || part === '')) return null;
    return {
      branch: fallbackBranch,
      path: pathParts.map(part => encodeURIComponent(part)).join('/'),
    };
  }

  const branch = rest[0];
  const pathParts = rest.slice(1);
  if (!branch || !pathParts.length || pathParts.some(part => part === '..' || part === '')) return null;
  return {
    branch,
    path: pathParts.map(part => encodeURIComponent(part)).join('/'),
  };
}

function contentTypeForPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.tsv')) return 'text/tab-separated-values';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function bufferResponseWithCap(res: Response) {
  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return { error: NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 }) };
  }

  const reader = res.body?.getReader();
  if (!reader) return { error: NextResponse.json({ error: 'No response body' }, { status: 502 }) };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > MAX_BYTES) {
      reader.cancel();
      return { error: NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 }) };
    }
    chunks.push(value);
  }

  return { body: Buffer.concat(chunks) };
}

async function fetchManagedGitHubFile(rawUrl: string, signal: AbortSignal): Promise<NextResponse | null> {
  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_REPO_OWNER;
  const repo   = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_REPO_BRANCH ?? 'main';
  if (!token || !owner || !repo) return null;

  const ghFile = rawUrlToGitHubFile(rawUrl, owner, repo, branch);
  if (!ghFile) return null;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${ghFile.path}?ref=${encodeURIComponent(ghFile.branch)}`;
  const upstream = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
    signal,
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: `GitHub returned ${upstream.status} for dataset file` }, { status: 502 });
  }

  const buffered = await bufferResponseWithCap(upstream);
  if (buffered.error) return buffered.error;

  return new NextResponse(buffered.body!, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForPath(ghFile.path),
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// Only allow URLs that exist on a published dataset.
// This prevents SSRF: no arbitrary URL can be proxied.
async function isAllowedUrl(url: string): Promise<boolean> {
  const db = adminClient();
  const sameUrl = (a: unknown, b: string) => {
    if (typeof a !== 'string') return false;
    if (a === b) return true;
    try { if (decodeURIComponent(a) === decodeURIComponent(b)) return true; } catch {}
    try { if (encodeURI(a) === encodeURI(b)) return true; } catch {}
    return false;
  };
  const { data: primaryData } = await db
    .from('data_center_datasets')
    .select('id')
    .eq('file_url', url)
    .eq('is_published', true)
    .maybeSingle();
  if (primaryData) return true;

  const { data, error } = await db
    .from('data_center_datasets')
    .select('file_url,files')
    .eq('is_published', true)
    .limit(1000);

  if (error) return false;
  return (data ?? []).some((dataset: any) => {
    if (sameUrl(dataset.file_url, url)) return true;
    return Array.isArray(dataset.files) && dataset.files.some((file: any) => sameUrl(file?.url, url));
  });
}

// Intentionally unauthenticated: this only proxies files attached to PUBLISHED datasets
// (enforced by isAllowedUrl below), which are themselves public. The SSRF surface is closed
// by validatePublicDatasetUrl + the published-dataset allowlist, not by a login check.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  const urlCheck = await validatePublicDatasetUrl(url);
  if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });

  // Allowlist check - must be attached to a published dataset
  const allowed = await isAllowedUrl(url);
  if (!allowed) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const managedGitHubResponse = await fetchManagedGitHubFile(url, controller.signal);
    if (managedGitHubResponse) {
      clearTimeout(timer);
      return managedGitHubResponse;
    }

    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'error',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 });
    }

    const buffered = await bufferResponseWithCap(upstream);
    if (buffered.error) return buffered.error;
    const body = buffered.body!;
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
