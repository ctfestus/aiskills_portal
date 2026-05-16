import dns from 'dns/promises';
import net from 'net';

const ALLOWED_DATASET_EXTENSIONS = new Set(['.csv', '.tsv', '.txt', '.json', '.zip', '.xlsx', '.xls']);
const ALLOWED_PROXY_TYPES = new Set([
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIPv4(ip: string) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string) {
  const h = normalizeHost(ip);
  if (h === '::' || h === '::1') return true;
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('ff')) return true;

  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return false;
}

function isPrivateIp(address: string) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

function hasAllowedDatasetExtension(url: URL) {
  const pathname = decodeURIComponent(url.pathname).toLowerCase();
  return [...ALLOWED_DATASET_EXTENSIONS].some(ext => pathname.endsWith(ext));
}

export function normalizeContentType(raw: string | null) {
  return raw?.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

export function isAllowedDatasetContentType(contentType: string) {
  return ALLOWED_PROXY_TYPES.has(contentType);
}

export async function validatePublicDatasetUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (parsed.protocol !== 'https:') return { ok: false, error: 'Only HTTPS URLs are allowed' };
  if (parsed.username || parsed.password) return { ok: false, error: 'Credentials in URLs are not allowed' };
  if (!hasAllowedDatasetExtension(parsed)) return { ok: false, error: 'URL must point to a supported dataset file type' };

  const hostname = normalizeHost(parsed.hostname);
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
    return { ok: false, error: 'URL points to a private or reserved host' };
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, error: 'URL points to a private or reserved address' };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some(record => isPrivateIp(record.address))) {
      return { ok: false, error: 'URL resolves to a private or reserved address' };
    }
  } catch {
    return { ok: false, error: 'Could not verify dataset URL host' };
  }

  return { ok: true, url: parsed };
}
