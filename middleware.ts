import { createServerClient } from '@supabase/ssr';
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

export async function middleware(req: NextRequest) {
  // Fallback: if a code lands on the root (Supabase fell back to the site URL),
  // send it to the callback Route Handler so it can exchange the code properly.
  const recoveryCode = req.nextUrl.searchParams.get('code');
  if (recoveryCode && req.nextUrl.pathname === '/') {
    const dest = new URL('/auth/callback', req.url);
    dest.searchParams.set('code', recoveryCode);
    return NextResponse.redirect(dest);
  }

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
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://video.bunnycdn.com https://www.canva.com",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isAppRoute ? ["frame-ancestors 'none'"] : []),
  ].join('; ');

  // Build request headers with nonce so Next.js stamps it onto inline scripts
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  let res = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresh Supabase auth session cookies on every request so they don't expire mid-visit
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          // Recreate the response so updated session cookies are sent to the browser
          res = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  res.headers.set('Content-Security-Policy', nonce ? csp : '');
  return res;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
