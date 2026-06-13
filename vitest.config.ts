import { defineConfig } from 'vitest/config';

// Node environment: this suite tests server-side route handlers and auth helpers,
// not React components, so no DOM is needed. resolve.tsconfigPaths resolves the `@/*` alias.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Dummy values so modules that construct a Supabase client at import time (admin-client)
    // don't throw. No client ever connects -- query seams are stubbed in the tests.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      RESEND_API_KEY: 're_test_key',
      APP_URL: 'http://localhost:3000',
    },
  },
});
