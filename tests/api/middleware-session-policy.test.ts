import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SESSION_LOOKUP_FREE_API_PATHS } from '@/lib/middleware-session-policy';

// Middleware does not read the cookie session on these paths, so the Route Handler is
// the only account-state boundary. Keep the allowlist tied to the implementation: a new
// entry cannot silently bypass restrictions without using the shared bearer boundary.
// This is deliberately a file-level guard, not a per-method control-flow proof. Mixed
// handlers such as platform-settings may expose a public GET while protecting mutations;
// reviewers must assess that method split when adding a new bypass.
const SHARED_AUTH_CALL = /\brequire(?:User|Role|StudentUser)\s*\(/;

function routeFile(pathname: string): string {
  return join(process.cwd(), 'app', ...pathname.split('/').filter(Boolean), 'route.ts');
}

describe('middleware session-lookup bypass policy', () => {
  it.each(SESSION_LOOKUP_FREE_API_PATHS)(
    '%s delegates authentication to its Route Handler',
    (pathname) => {
      const file = routeFile(pathname);
      expect(existsSync(file), `${pathname} has no Route Handler at ${file}`).toBe(true);
      expect(
        readFileSync(file, 'utf8'),
        `${pathname} bypasses middleware session enforcement, so its Route Handler must `
        + 'call requireUser, requireRole, or requireStudentUser.',
      ).toMatch(SHARED_AUTH_CALL);
    },
  );

  it.each([
    '/api/upload',
    '/api/assets',
    '/api/assignments/submit-confirm',
  ])('%s remains behind middleware because it authenticates from cookies', (pathname) => {
    expect(SESSION_LOOKUP_FREE_API_PATHS).not.toContain(pathname);
  });
});
