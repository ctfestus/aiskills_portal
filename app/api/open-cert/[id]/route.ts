import { NextRequest, NextResponse } from 'next/server';
import { loadOpenCert } from '@/lib/open-cert';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadOpenCert(id);

  if (result.status === 'notfound') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (result.status === 'revoked')  return NextResponse.json({ revoked: true });

  return NextResponse.json(result.data);
}
