/**
 * Upload a file to Cloudinary via the /api/upload server route.
 * Returns the secure CDN URL.
 */
export async function uploadToCloudinary(file: File | Blob, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);

  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Upload failed');
    throw new Error(msg);
  }
  const { url } = await res.json();
  return url as string;
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
