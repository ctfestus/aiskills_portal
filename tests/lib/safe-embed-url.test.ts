import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  safeEmbedUrl,
  isHtmlEmbedUrl,
  isStorageHtmlEmbedUrl,
  HTML_EMBED_PROXY_PATH,
} from '@/lib/safe-embed-url';

// The iframe-src whitelist is a security boundary: only known video providers
// and .html files on THIS project's public form-assets bucket may reach an
// iframe. Storage HTML is rewritten to the sandboxing proxy (Supabase serves
// HTML as plain text on the default domain, so it cannot be iframed directly).
// These tests pin the strict host/path/extension checks so the HTML branch
// cannot be widened into embedding arbitrary URLs.

const PROJECT_URL = 'https://testproj.supabase.co';
const HTML_URL = `${PROJECT_URL}/storage/v1/object/public/form-assets/lesson-html/user-1/1700000000000.html`;
const PROXIED_HTML_URL = `${HTML_EMBED_PROXY_PATH}?url=${encodeURIComponent(HTML_URL)}`;

let savedEnv: string | undefined;

beforeAll(() => {
  savedEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT_URL;
});

afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv;
});

describe('safeEmbedUrl video providers (existing behavior)', () => {
  it('reconstructs a canonical YouTube embed URL', () => {
    expect(safeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0');
  });

  it('appends ?embed to Canva design URLs', () => {
    expect(safeEmbedUrl('https://www.canva.com/design/ABC123/view'))
      .toBe('https://www.canva.com/design/ABC123/view?embed');
  });

  it('rejects unknown hosts', () => {
    expect(safeEmbedUrl('https://example.com/video')).toBeNull();
  });
});

describe('safeEmbedUrl HTML embeds', () => {
  it('rewrites a storage .html URL to the sandboxing proxy', () => {
    expect(safeEmbedUrl(HTML_URL)).toBe(PROXIED_HTML_URL);
  });

  it('passes an already-proxied URL through when the inner URL revalidates', () => {
    expect(safeEmbedUrl(PROXIED_HTML_URL)).toBe(PROXIED_HTML_URL);
  });

  it('rejects a proxied URL whose inner URL is not this project storage', () => {
    const evil = `${HTML_EMBED_PROXY_PATH}?url=${encodeURIComponent('https://evil.com/a.html')}`;
    expect(safeEmbedUrl(evil)).toBeNull();
    expect(safeEmbedUrl(`${HTML_EMBED_PROXY_PATH}?nope=1`)).toBeNull();
  });
});

describe('isStorageHtmlEmbedUrl', () => {
  it('accepts an .html file on this project form-assets bucket', () => {
    expect(isStorageHtmlEmbedUrl(HTML_URL)).toBe(true);
  });

  it('accepts .htm and uppercase extensions, and ignores query strings', () => {
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/public/form-assets/a.htm`)).toBe(true);
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/public/form-assets/a.HTML`)).toBe(true);
    expect(isStorageHtmlEmbedUrl(`${HTML_URL}?download=false`)).toBe(true);
  });

  it('rejects other hosts, including lookalikes', () => {
    expect(isStorageHtmlEmbedUrl('https://evil.com/storage/v1/object/public/form-assets/a.html')).toBe(false);
    expect(isStorageHtmlEmbedUrl('https://testproj.supabase.co.evil.com/storage/v1/object/public/form-assets/a.html')).toBe(false);
    expect(isStorageHtmlEmbedUrl('https://evil.com/?x=testproj.supabase.co/storage/v1/object/public/form-assets/a.html')).toBe(false);
  });

  it('rejects non-https, other buckets, non-public paths, and non-html files', () => {
    expect(isStorageHtmlEmbedUrl(HTML_URL.replace('https://', 'http://'))).toBe(false);
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/public/datasets/a.html`)).toBe(false);
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/sign/form-assets/a.html`)).toBe(false);
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/public/form-assets/a.pdf`)).toBe(false);
    expect(isStorageHtmlEmbedUrl(`${PROJECT_URL}/storage/v1/object/public/form-assets/a.html.txt`)).toBe(false);
  });

  it('fails closed when the URL is garbage or the env var is unset', () => {
    expect(isStorageHtmlEmbedUrl('not a url')).toBe(false);
    expect(isStorageHtmlEmbedUrl('')).toBe(false);
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(isStorageHtmlEmbedUrl(HTML_URL)).toBe(false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
  });
});

describe('isHtmlEmbedUrl (player sizing/sandbox check)', () => {
  it('recognizes both the stored form and the proxied form', () => {
    expect(isHtmlEmbedUrl(HTML_URL)).toBe(true);
    expect(isHtmlEmbedUrl(PROXIED_HTML_URL)).toBe(true);
  });

  it('rejects video embeds and arbitrary URLs', () => {
    expect(isHtmlEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0')).toBe(false);
    expect(isHtmlEmbedUrl('https://www.canva.com/design/ABC123/view?embed')).toBe(false);
    expect(isHtmlEmbedUrl('https://evil.com/a.html')).toBe(false);
  });
});
