import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx',
  '.xls', '.xlsx', '.csv', '.tsv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip', '.json', '.txt', '.md',
]);

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getSessionUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user) return null;
  const { data: s } = await adminClient().from('students').select('role').eq('id', user.id).single();
  const role = s?.role ?? 'student';
  if (role !== 'admin' && role !== 'instructor') return null;
  return user;
}

function sanitizeFilename(raw: string): string {
  const base = path.basename(raw);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, 'file');
}

const SAFE_FOLDER = /^[a-zA-Z0-9_\-/]+$/;
function sanitizeFolder(raw: string | null): string {
  const f = (raw ?? 'assignment-resources').replace(/^\/+|\/+$/g, '');
  if (!f || !SAFE_FOLDER.test(f) || f.includes('..')) return 'assignment-resources';
  return f;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_REPO_OWNER;
  const repo   = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_REPO_BRANCH ?? 'main';

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub integration not configured. Add GITHUB_TOKEN, GITHUB_REPO_OWNER and GITHUB_REPO_NAME to .env' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}` }, { status: 400 });
  }

  const safeName = sanitizeFilename(file.name);
  const folder   = sanitizeFolder(form.get('folder') as string | null);
  const filePath = `${folder}/${Date.now()}_${safeName}`;

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const ghRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: `Upload assignment resource: ${safeName}`,
      content: base64,
      branch,
    }),
  });

  if (!ghRes.ok) {
    const err = await ghRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? `GitHub API error ${ghRes.status}` }, { status: 502 });
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  return NextResponse.json({ url: rawUrl, name: file.name });
}

// DELETE /api/assignments/github-upload
// Body: { url: string } -- a raw.githubusercontent.com URL produced by POST.
// Removes the file from the repo (working tree; git history retains it).
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo  = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub integration not configured.' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const url: string = body?.url ?? '';
  const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });

  const [, mOwner, mRepo, mBranch, rawPath] = m;
  if (mOwner !== owner || mRepo !== repo) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const filePath = rawPath.split('/').map(decodeURIComponent).join('/');
  if (filePath.includes('..')) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Look up the file SHA (required to delete via the Contents API)
  const metaRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(mBranch)}`, { headers: ghHeaders });
  if (metaRes.status === 404) return NextResponse.json({ ok: true }); // already gone
  if (!metaRes.ok) return NextResponse.json({ error: `GitHub API error ${metaRes.status}` }, { status: 502 });
  const meta = await metaRes.json();
  const sha = Array.isArray(meta) ? null : meta?.sha;
  if (!sha) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const delRes = await fetch(apiUrl, {
    method: 'DELETE',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Delete ${filePath}`, sha, branch: mBranch }),
  });
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? `GitHub API error ${delRes.status}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
