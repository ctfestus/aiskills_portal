import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';


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

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_REPO_OWNER;
  const repo   = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_REPO_BRANCH ?? 'main';

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub integration not configured. Add GITHUB_TOKEN, GITHUB_REPO_OWNER and GITHUB_REPO_NAME to .env' }, { status: 500 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const ghFile = rawUrlToGitHubFile(url, owner, repo, branch);
  if (!ghFile) {
    return NextResponse.json({ skipped: true, reason: 'URL is not managed by this GitHub dataset repository' });
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${ghFile.path}?ref=${encodeURIComponent(ghFile.branch)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const metaRes = await fetch(apiUrl, { headers });
  if (metaRes.status === 404) return NextResponse.json({ deleted: true, alreadyMissing: true });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? `GitHub API error ${metaRes.status}` }, { status: 502 });
  }

  const meta = await metaRes.json();
  if (!meta?.sha || meta.type !== 'file') {
    return NextResponse.json({ error: 'GitHub path is not a file' }, { status: 400 });
  }

  const deleteRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${ghFile.path}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Delete dataset file: ${decodeURIComponent(ghFile.path).split('/').pop() ?? ghFile.path}`,
      sha: meta.sha,
      branch: ghFile.branch,
    }),
  });

  if (!deleteRes.ok) {
    const err = await deleteRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? `GitHub API error ${deleteRes.status}` }, { status: 502 });
  }

  return NextResponse.json({ deleted: true });
}
