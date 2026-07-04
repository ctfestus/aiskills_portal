import { supabase } from '@/lib/supabase';

/**
 * Upload a file DIRECTLY from the browser to Supabase Storage (the public `form-assets`
 * bucket -- the same one badge images use). This bypasses the Cloudinary `/api/upload`
 * route, which cannot carry large media: the Next.js middleware caps the buffered request
 * body at ~10MB, and Vercel serverless request bodies are capped at ~4.5MB. A direct
 * client-to-Supabase upload has no such ceiling, so it is the path for large media like
 * lesson audio (mirrors how VE datasets and badge images already upload).
 *
 * `folder` scopes the object path (e.g. 'lesson-audio'); the caller's user id is appended
 * so objects are namespaced per user. Returns the public URL. Cleanup is handled by
 * deleteUploadedFile(), which already recognizes Supabase Storage public URLs.
 */
export async function uploadToStorage(file: File, folder: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${folder}/${session?.user.id ?? 'anon'}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('form-assets').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message || 'Upload failed');
  const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path);
  return publicUrl;
}
