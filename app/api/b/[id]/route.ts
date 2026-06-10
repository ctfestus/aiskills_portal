import { NextRequest, NextResponse } from 'next/server';
import { loadBadge } from '@/lib/badge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await loadBadge(id);

  if (result.status === 'notfound') return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(result.data);
}
