import { NextRequest, NextResponse } from 'next/server';

// App routes that must never be iframed
const APP_ROUTE = /^\/(dashboard|settings|create|admin|auth|onboarding|student)/;

const isDev = process.env.NODE_ENV === 'development';

// Web Crypto API -- available in Edge runtime (no Node.js crypto needed)
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
  const isAppRoute  = APP_ROUTE.test(req.nextUrl.pathname);

  // Generate a unique cryptographic nonce per request.
  // Next.js reads the x-nonce request header and stamps it onto its inline scripts,
  // replacing the need for unsafe-inline in production.
  const nonce = generateNonce();

  const csp = [
    "default-src 'self'",

    // Production: nonce-only -- no unsafe-inline, no unsafe-eval.
    // Development: add unsafe-eval for HMR/webpack dev runtime.
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}'`,

    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src https: data: blob:",
    `connect-src 'self' ${supabaseUrl} https://*.supabase.co https://api.resend.com wss://*.supabase.co`,
    "media-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://video.bunnycdn.com",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isAppRoute ? ["frame-ancestors 'none'"] : []),
  ].join('; ');

  const res = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(req.headers),
        // Pass nonce to Next.js so it stamps inline scripts automatically
        'x-nonce': nonce,
      }),
    },
  });

  res.headers.set('Content-Security-Policy', nonce ? csp : '');
  return res;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
