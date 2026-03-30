import type {NextConfig} from 'next';

// CSP is set per-request in middleware.ts using a cryptographic nonce.
// Only non-CSP security headers are defined here.

const commonHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

// Public pages -- embeddable
const publicHeaders = [
  ...commonHeaders,
];

// App/auth routes -- never embeddable
const appHeaders = [
  ...commonHeaders,
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  experimental: {
    // Enables Next.js to read x-nonce from the request header and stamp it
    // onto its inline scripts, allowing nonce-based CSP without unsafe-inline.
    nonce: true,
  },
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
