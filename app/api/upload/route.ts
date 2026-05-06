import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cloudinary, extractPublicId } from '@/lib/cloudinary-server';

// Auth helper -- server component style
async function getSession() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { session } } = await client.auth.getSession();
  return session;
}

const SAFE_SUBFOLDER = /^[a-zA-Z0-9_\-/]+$/;

// POST /api/upload
// Body: multipart/form-data with `file` (File) and optional `folder` (subfolder name)
// Returns: { url: string, publicId: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
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

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', overwrite: true },
      (err, res) => {
        if (err || !res) reject(err ?? new Error('Upload failed'));
        else resolve(res as { secure_url: string; public_id: string });
      },
    ).end(buffer);
  });

  // SVGs must not have f_auto applied -- Cloudinary converts them to raster, breaking the image.
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const optimisedUrl = isSvg
    ? result.secure_url
    : result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');

  return NextResponse.json({ url: optimisedUrl, publicId: result.public_id });
}

// DELETE /api/upload
// Body: { publicId: string } OR { url: string }
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const publicId: string | null = body?.publicId ?? (body?.url ? extractPublicId(body.url) : null);

  if (!publicId) return NextResponse.json({ error: 'No publicId provided' }, { status: 400 });

  // Ownership check -- publicId must live under the caller's own folder
  if (!publicId.startsWith(`users/${session.user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});

  return NextResponse.json({ ok: true });
}
