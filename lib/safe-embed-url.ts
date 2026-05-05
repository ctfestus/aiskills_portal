/**
 * Returns a safe iframe embed URL for known video providers, or null if the
 * input cannot be validated.
 *
 * YouTube and Vimeo: extract the typed ID and reconstruct a canonical embed URL
 * so no raw user-supplied URL ever reaches the iframe src.
 *
 * Bunny.net and Canva: validate protocol, exact hostname, and path prefix with
 * new URL() -- prevents substring-bypass attacks like:
 *   https://evil.com/?x=iframe.mediadelivery.net/embed/123
 * The original URL is returned unchanged so query params are preserved.
 */
export function safeEmbedUrl(raw: string): string | null {
  if (!raw) return null;

  // YouTube -- reconstruct canonical embed URL from extracted video ID
  const yt = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;

  // Vimeo -- reconstruct canonical embed URL from extracted numeric ID
  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Parse all other providers strictly -- substring checks are bypassable
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;

  const { hostname, pathname } = parsed;

  // Bunny.net embed players (iframe.mediadelivery.net and player.mediadelivery.net)
  // Path must start with /embed/ to match the expected embed URL shape
  if (
    (hostname === 'iframe.mediadelivery.net' || hostname === 'player.mediadelivery.net') &&
    pathname.startsWith('/embed/')
  ) return raw;

  // Bunny.net direct stream variant
  if (hostname === 'video.bunnycdn.com') return raw;

  // Canva presentations -- append ?embed if no query string present
  if (
    (hostname === 'www.canva.com' || hostname === 'canva.com') &&
    pathname.startsWith('/design/')
  ) return raw.includes('?') ? raw : `${raw}?embed`;

  return null;
}
