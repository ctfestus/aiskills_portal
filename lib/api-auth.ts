// Shared API auth for route handlers. Centralizes Bearer-token parsing, service-role
// user verification, and role checks so every route enforces them the same way instead
// of hand-rolling the pattern (and risking a forgotten check).
//
// Roles come from students.role -- never the profiles table.

import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

type Supabase = ReturnType<typeof adminClient>;

export interface AuthedUser {
  user: { id: string; email?: string };
  supabase: Supabase;
}
export interface AuthedRole extends AuthedUser {
  role: string;
}

/** Narrow an auth result: returns true (and gives TS the error response) when auth failed. */
export function isAuthError<T>(r: T | { error: NextResponse }): r is { error: NextResponse } {
  return (r as { error?: NextResponse }).error instanceof NextResponse;
}

/**
 * Verify the Bearer token and return the authenticated user + a service-role client.
 * On failure returns `{ error: NextResponse }` (401) -- callers do:
 *   const auth = await requireUser(req); if (isAuthError(auth)) return auth.error;
 */
export async function requireUser(req: NextRequest): Promise<AuthedUser | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const jwt = authHeader.slice(7);
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user: { id: user.id, email: user.email ?? undefined }, supabase };
}

/**
 * Like requireUser, but also requires the caller's students.role to be in `allowedRoles`.
 * Returns 401 if unauthenticated, 403 if the role is not allowed.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: string[],
): Promise<AuthedRole | { error: NextResponse }> {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth;

  const { data: student } = await auth.supabase
    .from('students')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  if (!student || !allowedRoles.includes(student.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ...auth, role: student.role };
}
