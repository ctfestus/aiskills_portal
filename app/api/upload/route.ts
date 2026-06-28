import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { cloudinary, extractPublicId } from '@/lib/cloudinary-server';

// Auth helper -- server component style. Returns the session and the (RLS-scoped) client.
async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { session } } = await supabase.auth.getSession();
  return { session, supabase };
}

const SAFE_SUBFOLDER = /^[a-zA-Z0-9_\-/]+$/;

// Content tables that store a cover_image. One image can be referenced by several items
// (reused from the library, or carried by a duplicated item), so it must not be destroyed
// while another item still uses it as a cover.
const COVER_TABLES = ['courses', 'events', 'virtual_experiences', 'assignments', 'learning_paths'] as const;

// POST /api/upload
// Body: multipart/form-data with `file` (File) and optional `folder` (subfolder name)
// Returns: { url: string, publicId: string }
export async function POST(req: NextRequest) {
  const { session } = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file          = form.get('file') as File | null;
  const rawSubfolder  = (form.get('folder') as string | null) ?? 'assets';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 });

  // Reject any subfolder that contains path traversal or unsafe characters
  if (!SAFE_SUBFOLDER.test(rawSubfolder) || rawSubfolder.includes('..')) {
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
  }

  // Always scope uploads to the authenticated user -- client never controls the root path
  const folder = `users/${session.user.id}/${rawSubfolder}`;

  // Convert Web File Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadOpts: Record<string, unknown> = { folder, resource_type: 'auto', overwrite: true };

  // Reject duplicate uploads only for content COVERS, where a byte-identical image is a real
  // duplicate the user should reuse from the library. Other folders (branding logos, lesson
  // images, avatars) legitimately reuse the same file -- e.g. the same image for light and dark
  // logo -- so they must NOT be blocked. Non-image files (PDFs) have no library to reuse from.
  if (file.type.startsWith('image/') && rawSubfolder === 'covers') {
    const contentHash = createHash('sha1').update(buffer).digest('hex');
    const publicId = `${folder}/${contentHash}`;
    let exists = false;
    try {
      await cloudinary.api.resource(publicId, { resource_type: 'image' });
      exists = true;
    } catch (err: unknown) {
      // 404 is the normal "no duplicate" case. Any other failure (network, rate limit, auth)
      // must not block uploads, but log it so a broken dedup check is visible rather than silent.
      const code = (err as { http_code?: number; error?: { http_code?: number } })?.error?.http_code
        ?? (err as { http_code?: number })?.http_code;
      if (code !== 404) {
        console.error('[api/upload] duplicate-check failed (proceeding):', (err as Error)?.message ?? err);
      }
    }
    if (exists) {
      return NextResponse.json(
        { error: 'This image has already been uploaded. Select it from the image library instead of uploading it again.' },
        { status: 409 },
      );
    }
    uploadOpts.public_id = contentHash;
    uploadOpts.overwrite = false; // guard against a race between the check and the upload
  }

  const result = await new Promise<{ secure_url: string; public_id: string; pages?: number }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      uploadOpts,
      (err, res) => {
        if (err || !res) reject(err ?? new Error('Upload failed'));
        else resolve(res as { secure_url: string; public_id: string; pages?: number });
      },
    ).end(buffer);
  });

  // SVGs must not have f_auto applied -- Cloudinary converts them to raster, breaking the image.
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const optimisedUrl = isSvg
    ? result.secure_url
    : result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');

  return NextResponse.json({ url: optimisedUrl, publicId: result.public_id, pages: result.pages ?? 1 });
}

// DELETE /api/upload
// Body: { publicId: string } OR { url: string }
export async function DELETE(req: NextRequest) {
  const { session, supabase } = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const publicId: string | null = body?.publicId ?? (body?.url ? extractPublicId(body.url) : null);

  if (!publicId) return NextResponse.json({ error: 'No publicId provided' }, { status: 400 });

  // Ownership check -- publicId must live under the caller's own folder
  if (!publicId.startsWith(`users/${session.user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Deletion guard: one image can back several items (reused from the library, or carried by a
  // duplicated item). Skip the destroy if any content still references it as a cover, so changing
  // or removing one item's cover never breaks another's.
  // Escape LIKE metacharacters so a public_id containing `_`/`%` matches literally.
  const likeNeedle = `%${publicId.replace(/[\\%_]/g, '\\$&')}%`;
  for (const table of COVER_TABLES) {
    const { data, error } = await supabase.from(table).select('id').ilike('cover_image', likeNeedle).limit(1);
    if (error) {
      // On error, keep the asset rather than risk destroying a shared one.
      return NextResponse.json({ ok: true, skipped: 'reference-check-failed' });
    }
    if (data && data.length) return NextResponse.json({ ok: true, skipped: 'referenced' });
  }

  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});

  return NextResponse.json({ ok: true });
}
