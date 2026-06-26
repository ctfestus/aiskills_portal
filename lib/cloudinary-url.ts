/**
 * Resolve a stored cover/image reference to a deliverable URL.
 *
 * New uploads store a bare Cloudinary public_id (e.g. "users/<uid>/covers/abc").
 * Legacy values are full URLs (Cloudinary, Supabase Storage, or any other host)
 * and are returned unchanged for backward compatibility.
 *
 * Storing the public_id instead of a baked-in URL means switching the Cloudinary
 * account only requires moving the assets and updating CLOUDINARY_CLOUD_NAME --
 * no database rows have to be rewritten and no saved URL can point at a dead account.
 */
// Single source of truth: CLOUDINARY_CLOUD_NAME. It's non-secret (it appears in every delivery
// URL), and next.config.ts exposes it to the browser bundle under the same name, so this one var
// works both client- and server-side -- no NEXT_PUBLIC_ duplicate to keep in sync.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? '';

const DEFAULT_TRANSFORM = 'f_auto,q_auto';

/** True when the value is already a full URL or data/blob ref we should deliver as-is. */
function isAbsoluteRef(ref: string): boolean {
  return (
    ref.startsWith('http://') ||
    ref.startsWith('https://') ||
    ref.startsWith('data:') ||
    ref.startsWith('blob:') ||
    ref.startsWith('/') // app-relative path
  );
}

/**
 * Turn a stored reference into a deliverable image URL.
 * @param ref       Stored value: a bare Cloudinary public_id, a full URL, or empty.
 * @param transform Cloudinary transformation string (default f_auto,q_auto). Pass '' for none.
 */
export function resolveImageUrl(ref?: string | null, transform: string = DEFAULT_TRANSFORM): string {
  if (!ref) return '';
  const value = ref.trim();
  if (!value) return '';
  if (isAbsoluteRef(value)) return value; // legacy full URL / data / blob -- deliver unchanged

  // Bare Cloudinary public_id. Without a configured cloud we cannot build a URL,
  // so return the raw value rather than emit a guaranteed-broken cloudinary URL.
  if (!CLOUD_NAME) return value;

  const t = transform ? `${transform}/` : '';
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${t}${value}`;
}

/** Convenience alias for content cover images. */
export const resolveCoverUrl = (ref?: string | null, transform?: string) => resolveImageUrl(ref, transform);

/** True when a stored value is a bare public_id (i.e. needs resolving), not a full URL. */
export const isPublicIdRef = (ref?: string | null): boolean =>
  !!ref && !!ref.trim() && !isAbsoluteRef(ref.trim());
