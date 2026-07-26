// Shared contract for instructor SOLUTION files (the model answer for an assignment).
//
// Authored with the assignment, released to a student only once their own submission -- or their
// group's -- is graded. Files live in a PRIVATE storage bucket, so there is no public URL to leak:
// the browser links to /api/assignments/solution-file?id=<row id>, which re-checks release and
// redirects to a short-lived signed URL. Links (kind='link') are gated by RLS alone, since an
// external URL is not ours to sign.
//
// Pure module (no React / server imports) so the create UI, the student view, and both API routes
// agree on one shape.

export const SOLUTION_BUCKET = 'assignment-solutions';

export interface AssignmentSolution {
  id: string;
  name: string;
  kind: 'file' | 'link';
  storage_path?: string | null;   // kind='file'
  url?: string | null;            // kind='link'
}

// Same set the assignment resource uploader accepts, plus the data/notebook formats a worked
// solution tends to be. Enforced server-side; the client `accept` attribute is UX only.
export const ALLOWED_SOLUTION_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx',
  '.xls', '.xlsx', '.csv', '.tsv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip', '.json', '.txt', '.md', '.sql', '.ipynb', '.py', '.r',
  '.pbix', '.pbip',
]);

export function solutionExtOf(name: string): string {
  const clean = (name || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
}

export function isAllowedSolutionFile(name: string): boolean {
  return ALLOWED_SOLUTION_EXTENSIONS.has(solutionExtOf(name));
}

// Ask the gated route for a short-lived signed URL for one solution file. The caller passes its
// Supabase access token (the route is Bearer-authed like the rest of the API) and then navigates
// to the returned URL -- it is served as an attachment, so the page itself does not unload.
export async function fetchSolutionFileUrl(id: string, token: string): Promise<string> {
  const res = await fetch(`/api/assignments/solution-file?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.url) throw new Error(json?.error || 'Could not open the solution file.');
  return json.url as string;
}

// Ask the server to bin any of these solution files that no assignment references any more (plus
// its routine sweep of long-orphaned objects). Fire-and-forget: call it AFTER the save or delete
// that freed the files has succeeded, and never block the UI on it -- the route re-counts
// references itself, so a missed call only means the sweep collects them later.
export function requestSolutionCleanup(paths: string[], token: string): void {
  fetch('/api/assignments/solution-cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paths: paths.filter(Boolean) }),
  }).catch(() => {});
}

// A row is only usable if it actually carries its target (the DB CHECK enforces this, but rows can
// also arrive from an import or a half-filled editor draft).
export function isCompleteSolution(s: Partial<AssignmentSolution>): boolean {
  if (!s.name || !s.name.trim()) return false;
  return s.kind === 'link' ? !!s.url?.trim() : !!s.storage_path?.trim();
}
