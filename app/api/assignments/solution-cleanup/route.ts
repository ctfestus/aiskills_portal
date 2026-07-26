import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { SOLUTION_BUCKET } from '@/lib/assignment-solutions';

// Deletes solution files in the private bucket that NO assignment references any more.
//
// The private bucket has no storage policy, so only the service role can remove an object -- and
// the decision must not be taken by the caller: assignments can share a file (duplicating an
// assignment copies the row, not the object), so a file is only garbage when zero
// assignment_solutions rows point at it. This route re-counts references itself and ignores any
// path that is still in use, which is what makes it safe to call with a client-supplied list.
//
// Called fire-and-forget AFTER a successful save or assignment delete:
//   * `paths` -- the paths that assignment/editor used to reference. Deleted only if now unused.
//   * plus a sweep of long-orphaned objects, so files stranded by an abandoned upload (or by a
//     failed cleanup call) do not accumulate forever.
export const dynamic = 'force-dynamic';

// An object with no row is only garbage once it is old enough that nobody can still be authoring
// with it: files upload as soon as they are picked, and the row appears only when the instructor
// saves, so a freshly uploaded file is legitimately rowless for as long as that form stays open.
const SWEEP_MIN_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

const MAX_EXPLICIT_PATHS = 100;   // per call, from the caller's list
const MAX_SWEEP_CANDIDATES = 300; // objects examined per call
const MAX_SWEEP_DELETES = 100;    // objects removed per call

type Supabase = ReturnType<typeof adminClient>;

// Which of these paths are still referenced by some assignment.
async function referencedPaths(supabase: Supabase, paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const { data, error } = await supabase.from('assignment_solutions')
    .select('storage_path').in('storage_path', paths);
  // On a query error, treat every path as referenced: never delete on incomplete information.
  if (error) return new Set(paths);
  return new Set((data ?? []).map(r => r.storage_path as string).filter(Boolean));
}

// Objects in the bucket old enough to be considered, laid out as <uploaderId>/<file>.
async function sweepCandidates(supabase: Supabase): Promise<string[]> {
  const store = supabase.storage.from(SOLUTION_BUCKET);
  const { data: folders, error } = await store.list('', { limit: 200 });
  if (error) return [];
  const out: string[] = [];
  const cutoff = Date.now() - SWEEP_MIN_AGE_MS;
  for (const folder of folders ?? []) {
    // Folders come back with a null id; a real object at the root has one.
    if ((folder as any).id) continue;
    const { data: files } = await store.list(folder.name, { limit: 500 });
    for (const file of files ?? []) {
      if (!(file as any).id) continue;               // nested folder, not an object
      const created = (file as any).created_at;
      if (!created) continue;                         // unknown age -> leave it alone
      if (new Date(created).getTime() > cutoff) continue;
      out.push(`${folder.name}/${file.name}`);
      if (out.length >= MAX_SWEEP_CANDIDATES) return out;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;
  const isAdmin = auth.role === 'admin';

  const body = await req.json().catch(() => ({}));
  const requested: string[] = Array.isArray(body?.paths)
    ? [...new Set<string>(body.paths.filter((p: unknown): p is string => typeof p === 'string' && !!p.trim()))].slice(0, MAX_EXPLICIT_PATHS)
    : [];

  const supabase = adminClient();

  // A non-admin may only name files they uploaded themselves (paths are uploader-scoped). Anything
  // else is left to the sweep, so one instructor can never target another's in-flight upload.
  const ownPrefix = `${auth.user.id}/`;
  const explicit = isAdmin ? requested : requested.filter(p => p.startsWith(ownPrefix));

  const doomed: string[] = [];
  if (explicit.length > 0) {
    const stillUsed = await referencedPaths(supabase, explicit);
    doomed.push(...explicit.filter(p => !stillUsed.has(p)));
  }

  const candidates = (await sweepCandidates(supabase)).filter(p => !doomed.includes(p));
  if (candidates.length > 0) {
    const stillUsed = await referencedPaths(supabase, candidates);
    for (const p of candidates) {
      if (stillUsed.has(p)) continue;
      doomed.push(p);
      if (doomed.length >= MAX_SWEEP_DELETES) break;
    }
  }

  if (doomed.length === 0) return NextResponse.json({ deleted: 0 });

  const { error } = await supabase.storage.from(SOLUTION_BUCKET).remove(doomed);
  if (error) {
    console.error('[solution-cleanup]', error);
    return NextResponse.json({ error: 'Cleanup failed.' }, { status: 502 });
  }
  return NextResponse.json({ deleted: doomed.length });
}
