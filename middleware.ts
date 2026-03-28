import { NextRequest, NextResponse } from 'next/server';

// App routes that must never be iframed
const APP_ROUTE = /^\/(dashboard|settings|create|admin|auth|onboarding|student)/;

export function middleware(req: NextRequest) {
  // Generate a fresh cryptographic nonce for every request.
  // This replaces 'unsafe-inline' in script-src -- only scripts carrying this
  // nonce attribute will execute, so injected scripts are blocked.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
  const isAppRoute  = APP_ROUTE.test(req.nextUrl.pathname);

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' removed -- nonce covers Next.js hydration scripts
    `script-src 'self' 'nonce-${nonce}'`,
    // style unsafe-inline kept: Tailwind + CSS-in-JS require it;
    // CSS injection without script execution is low severity
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Restrict to https: -- blocks http: and javascript: image URIs
    "img-src https: data: blob:",
    `connect-src 'self' ${supabaseUrl} https://*.supabase.co https://api.resend.com`,
    "media-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://video.bunnycdn.com",
    "base-uri 'self'",
    "form-action 'self'",
    // App routes: block all framing. Public routes: allow (for embeds).
    ...(isAppRoute ? ["frame-ancestors 'none'"] : []),
  ].join('; ');

  // Forward the nonce to the Next.js runtime so it stamps nonce=""
  // on every inline <script> it generates during SSR.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
