import { v2 as cloudinary } from 'cloudinary';

// Configured once per process. All uploads go through this instance.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure:     true,
});

export { cloudinary };

/**
 * Extract the Cloudinary public_id from a secure URL.
 * Handles URLs with or without transformation parameters and version segments.
 *
 * Examples:
 *   .../upload/v1234/covers/abc.jpg           covers/abc
 *   .../upload/f_auto,q_auto/v1234/covers/abc.jpg  covers/abc
 *   .../upload/covers/abc.jpg                 covers/abc
 */
export function extractPublicId(url: string): string | null {
  // Preferred: anchor on version segment (v + digits) -- skips any transformations before it
  const withVersion = url.match(/\/upload\/(?:.+\/)?v\d+\/(.+)\.[^.]+$/);
  if (withVersion) return withVersion[1];
  // Fallback: no version in URL -- take everything after /upload/
  const withoutVersion = url.match(/\/upload\/(.+)\.[^.]+$/);
  return withoutVersion ? withoutVersion[1] : null;
}
