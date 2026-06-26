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
  const fd = new FormData();
  fd.append('file', file);
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
