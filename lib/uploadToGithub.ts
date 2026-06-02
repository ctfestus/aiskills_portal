import { supabase } from '@/lib/supabase';

const ENDPOINT = '/api/assignments/github-upload';

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/**
 * Upload a file to the configured GitHub repo via the server route.
 * Returns the raw.githubusercontent.com URL.
 */
export async function uploadToGithub(file: File | Blob, folder = 'assignment-resources'): Promise<{ url: string; name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch(ENDPOINT, { method: 'POST', headers: await authHeader(), body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Upload failed');
  }
  return res.json();
}

/** Delete a GitHub-hosted file by its raw URL. Fire-and-forget; never throws. */
export async function deleteFromGithub(url: string): Promise<void> {
  await fetch(ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

/** True if the URL is a GitHub raw-content URL. */
export const isGithubRawUrl = (url: string): boolean => url.includes('raw.githubusercontent.com');
