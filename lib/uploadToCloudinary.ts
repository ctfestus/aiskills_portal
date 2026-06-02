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
 */
export async function uploadToCloudinaryWithMeta(
  file: File | Blob,
  folder: string,
  publicId?: string,
): Promise<{ url: string; pages: number }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  if (publicId) fd.append('publicId', publicId);

  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Upload failed');
    throw new Error(msg);
  }
  const { url, pages } = await res.json();
  return { url: url as string, pages: typeof pages === 'number' && pages > 0 ? pages : 1 };
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
