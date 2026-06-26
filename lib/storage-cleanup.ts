import { deleteFromCloudinary, isCloudinaryUrl } from '@/lib/uploadToCloudinary';
import { deleteFromGithub, isGithubRawUrl } from '@/lib/uploadToGithub';
import { isPublicIdRef } from '@/lib/cloudinary-url';
import { supabase } from '@/lib/supabase';

/**
 * Delete an uploaded asset from whichever backend hosts it -- Cloudinary,
 * GitHub or Supabase Storage -- inferred from the value. Also handles a bare
 * Cloudinary public_id (the stable storage format). No-op for empty values,
 * data URLs and external links. Fire-and-forget: never throws.
 */
export async function deleteUploadedFile(url?: string | null): Promise<void> {
  if (!url) return;
  try {
    // Full Cloudinary URL, or a bare public_id (e.g. "users/<uid>/covers/abc").
    if (isCloudinaryUrl(url) || isPublicIdRef(url)) {
      await deleteFromCloudinary(url);
      return;
    }
    if (isGithubRawUrl(url)) {
      await deleteFromGithub(url);
      return;
    }
    // Supabase Storage public URL: .../storage/v1/object/public/<bucket>/<path>
    const marker = '/storage/v1/object/public/';
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const rest = url.slice(idx + marker.length);
    const slash = rest.indexOf('/');
    if (slash === -1) return;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    /* ignore cleanup failures */
  }
}
