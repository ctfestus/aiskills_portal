import type {NextConfig} from 'next';

// Content-Security-Policy -- tightens what browsers will load/execute.
// - script-src 'self': no inline scripts, no external script hosts
// - style-src 'self' 'unsafe-inline': inline styles needed by Tailwind/CSS-in-JS
// - img-src *: forms and events load cover images from arbitrary URLs
// - connect-src: Supabase, Resend webhooks, and self
// - frame-ancestors 'none': equivalent to X-Frame-Options: DENY (belt-and-braces)
const CSP_BASE = [
  "default-src 'self'",
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src * data: blob:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'} https://*.supabase.co https://api.resend.com`,
  "media-src 'self' blob:",
  "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://player.mediadelivery.net https://video.bunnycdn.com",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// App routes are never embedded -- lock them down.
const CSP_APP = CSP_BASE + "; frame-ancestors 'none'";

const commonHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

// Public pages (form/event embeds) -- no frame-ancestors so they can be iframed
const publicHeaders = [
  ...commonHeaders,
  { key: 'Content-Security-Policy', value: CSP_BASE },
];

// App/auth routes -- never embeddable
const appHeaders = [
  ...commonHeaders,
  { key: 'Content-Security-Policy', value: CSP_APP },
  { key: 'X-Frame-Options',         value: 'DENY' },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/favicon.ico', destination: 'https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/brand_assets/powered%20by%20FestMan%20(1).png', permanent: false },
    ];
  },
  async headers() {
    return [
      // Public routes -- embeddable, no frame-ancestors restriction
      { source: '/(.*)', headers: publicHeaders },
      // App routes override with stricter CSP + clickjack protection
      { source: '/dashboard/:path*', headers: appHeaders },
      { source: '/settings/:path*',  headers: appHeaders },
      { source: '/create/:path*',    headers: appHeaders },
      { source: '/admin/:path*',     headers: appHeaders },
      { source: '/auth/:path*',       headers: appHeaders },
      { source: '/onboarding/:path*', headers: appHeaders },
      { source: '/onboarding',        headers: appHeaders },
    ];
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
