import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cloudinary } from '@/lib/cloudinary-server';

async function getVerifiedUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

// GET /api/assets?folder=<subfolder>&cursor=<next_cursor>
// Lists image assets uploaded by the current user from Cloudinary.
// folder: optional subfolder (e.g. "lesson-images", "covers"). Omit for all user images.
// cursor: pagination cursor from a previous response.
export async function GET(req: NextRequest) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const folder = searchParams.get('folder') ?? '';
  const cursor = searchParams.get('cursor') || undefined;

  // Always scope to the authenticated user's own folder tree
  const prefix = folder
    ? `users/${user.id}/${folder}/`
    : `users/${user.id}/`;

  const result = await cloudinary.api.resources({
    type: 'upload',
    resource_type: 'image',
    prefix,
    max_results: 24,
    next_cursor: cursor,
  });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

  const images = (result.resources as Array<{
    public_id: string;
    secure_url: string;
    created_at: string;
    width: number;
    height: number;
    format: string;
  }>).map((r) => {
    const isSvg = r.format === 'svg';
    const url = isSvg
      ? r.secure_url
      : r.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    const thumbUrl = isSvg
      ? r.secure_url
      : `https://res.cloudinary.com/${cloudName}/image/upload/w_200,h_150,c_fill/${r.public_id}.${r.format}`;
    const subFolder = r.public_id
      .replace(`users/${user.id}/`, '')
      .split('/')
      .slice(0, -1)
      .join('/') || 'assets';

    return {
      publicId: r.public_id,
      url,
      thumbUrl,
      folder: subFolder,
      format: r.format,
      createdAt: r.created_at,
      width: r.width,
      height: r.height,
    };
  });

  return NextResponse.json({ images, nextCursor: result.next_cursor ?? null });
}
