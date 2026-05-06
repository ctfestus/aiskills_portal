import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = adminClient();
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await db.from('students').select('role').eq('id', user.id).single();
  if (!caller || !['admin', 'instructor'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const { data: target } = await db.from('students').select('role').eq('id', userId).single();
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  if (target.role !== 'student') {
    if (caller.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete staff accounts.' }, { status: 403 });
    }
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
