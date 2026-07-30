import { compressImageForUpload, profileFor } from '@/lib/compress-image';

// Vercel rejects a serverless request body over ~4.5MB at the edge with
// FUNCTION_PAYLOAD_TOO_LARGE, before /api/upload runs -- so the route's own 20MB limit is
// never reached. Sit just under the platform cap so nothing that uploads today starts
// failing: images are shrunk well below it automatically, and a non-image that is genuinely
// too big (a large PDF) gets a readable message instead of an opaque 413.
export const MAX_UPLOAD_BYTES = 4.3 * 1024 * 1024;

/** Display form of MAX_UPLOAD_BYTES, so UI copy can never drift from the enforced limit. */
export const MAX_UPLOAD_LABEL = '4.3 MB';

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Upload a file to Cloudinary via the /api/upload server route.
 * Returns the secure CDN URL.
 */
export async function uploadToCloudinary(file: File | Blob, folder: string, publicId?: string): Promise<string> {
  return (await uploadToCloudinaryWithMeta(file, folder, publicId)).url;
}

/**
 * Same as uploadToCloudinary but also returns metadata from Cloudinary.
 * `pages` is the page count for multi-page assets (PDFs); 1 otherwise.
 * `publicId` is the Cloudinary public_id (account-agnostic), suitable for
 * persisting and resolving later via resolveImageUrl().
 */
export async function uploadToCloudinaryWithMeta(
  file: File | Blob,
  folder: string,
  publicId?: string,
): Promise<{ url: string; pages: number; publicId: string }> {
  // Raster images are downscaled/re-encoded here, with the profile chosen by folder, so a
  // camera or phone photo is not rejected by the platform before the route can see it.
  // Non-images pass through untouched.
  const prepared = await compressImageForUpload(file, profileFor(folder));

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `This file is ${mb(prepared.size)}. Uploads are limited to ${mb(MAX_UPLOAD_BYTES)} -- please compress it and try again.`,
    );
  }

  const fd = new FormData();
  fd.append('file', prepared);
  fd.append('folder', folder);
  if (publicId) fd.append('publicId', publicId);

  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text || 'Upload failed';
    try { const j = JSON.parse(text); if (j?.error) msg = j.error; } catch { /* not JSON -- keep raw text */ }
    throw new Error(msg);
  }
  const { url, pages, publicId: returnedId } = await res.json();
  return {
    url: url as string,
    pages: typeof pages === 'number' && pages > 0 ? pages : 1,
    publicId: (returnedId as string) ?? '',
  };
}

/**
 * Upload a cover image and return a STABLE reference to persist.
 * Raster images return the bare Cloudinary public_id (account-agnostic, resolved at
 * render via resolveCoverUrl). SVGs return the full URL unchanged, because SVGs must
 * not have f_auto applied (Cloudinary would rasterize them) and resolveCoverUrl always
 * applies f_auto to bare public_ids.
 */
export async function uploadCoverImage(file: File, folder = 'covers'): Promise<string> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const { url, publicId } = await uploadToCloudinaryWithMeta(file, folder);
  return isSvg ? url : (publicId || url);
}

/**
 * Delete a Cloudinary asset by its full URL or publicId.
 */
export async function deleteFromCloudinary(urlOrPublicId: string): Promise<void> {
  const isUrl = urlOrPublicId.startsWith('http');
  await fetch('/api/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isUrl ? { url: urlOrPublicId } : { publicId: urlOrPublicId }),
  }).catch(() => {});
}

/**
 * Returns true if the URL is a Cloudinary URL (as opposed to Supabase Storage).
 */
export const isCloudinaryUrl = (url: string) =>
  url.includes('res.cloudinary.com');
