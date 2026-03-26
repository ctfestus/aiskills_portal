import { createHmac, timingSafeEqual } from 'crypto';

// Use a dedicated secret — never reuse the Supabase service role key for signing.
// Set STUDENT_TOKEN_SECRET to a long random string (e.g. openssl rand -hex 32).
const SECRET = () => {
  const key = process.env.STUDENT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('STUDENT_TOKEN_SECRET is not configured');
  return key;
};

export function signStudentToken(email: string): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours (was 30 days)
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  const sig = createHmac('sha256', SECRET()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyStudentToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', SECRET()).update(payload).digest('base64url');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > exp) return null;
    return email as string;
  } catch { return null; }
}
