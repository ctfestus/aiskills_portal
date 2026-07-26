import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { adminClient } from '@/lib/admin-client';
import { requireRole, isAuthError } from '@/lib/api-auth';
import { SOLUTION_BUCKET, isAllowedSolutionFile } from '@/lib/assignment-solutions';

// Uploads an instructor's model-answer file to the PRIVATE 'assignment-solutions' bucket
// (migration 144). Deliberately service-role only: that bucket has no storage policy, so this
// route is the sole way in, and /api/assignments/solution-file is the sole way out.
//
// The object path is scoped to the uploader, not the assignment: the file is picked while the
// assignment may not exist yet (create flow), and the row that ties it to an assignment is
// written when the instructor saves.
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB, matching the resource uploader

function sanitizeFilename(raw: string): string {
  const base = path.basename(raw);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, 'file');
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'instructor']);
  if (isAuthError(auth)) return auth.error;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  if (!isAllowedSolutionFile(file.name)) {
    return NextResponse.json({ error: 'File type not allowed for a solution file.' }, { status: 400 });
  }

  const objectPath = `${auth.user.id}/${Date.now()}_${sanitizeFilename(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await adminClient().storage.from(SOLUTION_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) {
    console.error('[solution-upload]', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ path: objectPath, name: file.name });
}
