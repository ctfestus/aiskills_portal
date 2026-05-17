import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_EXTENSIONS = new Set(['.csv', '.tsv', '.json', '.xlsx', '.xls', '.zip', '.pdf']);

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
  // Keep only the basename (strip any path components)
  const base = path.basename(raw);
  // Replace unsafe characters; ensure no leading dots
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, 'file');
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

  // Validate file size before reading into memory
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 });
  }

  // Validate file extension
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}` }, { status: 400 });
  }

  const safeName = sanitizeFilename(file.name);
  const filePath = `${Date.now()}_${safeName}`;

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
      message: `Upload dataset: ${safeName}`,
      content: base64,
      branch,
    }),
  });

  if (!ghRes.ok) {
    const err = await ghRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? `GitHub API error ${ghRes.status}` }, { status: 502 });
  }

  // raw.githubusercontent.com is only publicly accessible when the repo is public.
  // GITHUB_DATASET_REPO must point to a public repository.
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  return NextResponse.json({ url: rawUrl, name: file.name });
}
