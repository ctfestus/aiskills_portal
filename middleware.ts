import { NextRequest, NextResponse } from 'next/server';

// App routes that must never be iframed
const APP_ROUTE = /^\/(dashboard|settings|create|admin|auth|onboarding|student)/;

export function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
  const isAppRoute  = APP_ROUTE.test(req.nextUrl.pathname);

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' and 'unsafe-eval' required by Next.js (hydration scripts, webpack runtime).
    // Nonce-based CSP is not used here because Next.js does not automatically stamp the nonce
    // onto its own generated inline scripts, causing them to be blocked on production builds.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src https: data: blob:",
    `connect-src 'self' ${supabaseUrl} https://*.supabase.co https://api.resend.com`,
    "media-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://video.bunnycdn.com",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isAppRoute ? ["frame-ancestors 'none'"] : []),
  ].join('; ');

  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
