export function normalizeAbsoluteBaseUrl(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim().replace(/\/+$/, '');
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    } catch {}
  }

  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.replace(/\/+$/, '');
    const withProtocol = vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')
      ? vercelUrl
      : `https://${vercelUrl}`;
    try {
      return new URL(withProtocol).origin;
    } catch {}
  }
  return '';
}

export function absolutePath(baseUrl: string, path: string) {
  const base = normalizeAbsoluteBaseUrl(baseUrl);
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
