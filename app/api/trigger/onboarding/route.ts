import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { requireUser, isAuthError } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;
  const { user } = auth;

  if (!user.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch { /* name is optional */ }

  const client = new Client({
    token:   process.env.QSTASH_TOKEN!,
    baseUrl: process.env.QSTASH_URL ?? 'https://qstash-us-east-1.upstash.io',
  });
  await client.publishJSON({
    url: `${process.env.APP_URL}/api/workflows/onboarding`,
    // Identity comes from the verified session, never the request body -- otherwise this
    // endpoint is an open relay for firing the branded email sequence at arbitrary addresses.
    body: {
      email:  user.email,
      userId: user.id,
      name:   typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'there',
    },
  });

  return NextResponse.json({ ok: true });
}
