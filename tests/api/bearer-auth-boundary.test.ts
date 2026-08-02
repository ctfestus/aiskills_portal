import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Architectural guardrail.
//
// Account state -- password setup outstanding, signup not admitted -- is enforced for
// bearer-authenticated calls inside requireUser (lib/api-auth). A route that reads the
// Authorization header itself and calls supabase.auth.getUser(token) authenticates the
// caller while skipping that gate entirely. That is not hypothetical: /api/activity/feed
// and /api/vector/gaps both did exactly this and stayed reachable by a session that had
// not finished password setup, after the gate was supposedly closed everywhere.
//
// This is deliberately narrow. It bans verifying a SUPABASE USER TOKEN outside the
// shared boundary. It does not ban reading Authorization, because machine-auth routes
// (QStash cron, HMAC sync, shared-secret reindex) use unrelated schemes and are
// documented exceptions in CLAUDE.md.

const API_ROOT = join(process.cwd(), 'app', 'api');

/**
 * Routes that legitimately verify a Supabase user token outside lib/api-auth.
 * Adding an entry here is a decision to opt a route out of the account-state gate, so
 * each one needs a reason.
 */
const ALLOWLIST = new Map<string, string>([
  // (no exemptions -- every user-token route goes through requireUser)
]);

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(full);
  }
  return out;
}

/** `supabase.auth.getUser(<something>)` -- an argument means a token is being verified. */
const VERIFIES_A_TOKEN = /auth\s*\.\s*getUser\s*\(\s*[^)\s]/;

describe('bearer-token authentication boundary', () => {
  const offenders: string[] = [];

  for (const file of routeFiles(API_ROOT)) {
    const source = readFileSync(file, 'utf8');
    if (!VERIFIES_A_TOKEN.test(source)) continue;

    const route = relative(process.cwd(), file).split(sep).join('/');
    if (ALLOWLIST.has(route)) continue;
    offenders.push(route);
  }

  it('verifies Supabase user tokens only through lib/api-auth', () => {
    expect(
      offenders,
      'These routes verify a Supabase user token directly, which skips the account-state '
      + 'gate in requireUser. Use requireUser/requireRole/requireStudentUser instead, or '
      + 'add the route to ALLOWLIST in this test with a reason.',
    ).toEqual([]);
  });

  it('scans a meaningful number of routes, so a broken glob cannot pass silently', () => {
    expect(routeFiles(API_ROOT).length).toBeGreaterThan(20);
  });
});
