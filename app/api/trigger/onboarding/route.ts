import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const client = new Client({
    token:   process.env.QSTASH_TOKEN!,
    baseUrl: process.env.QSTASH_URL ?? 'https://qstash-us-east-1.upstash.io',
  });
  await client.publishJSON({
    url: `${process.env.APP_URL}/api/workflows/onboarding`,
    body,
  });

  return NextResponse.json({ ok: true });
}
