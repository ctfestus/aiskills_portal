import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function shortSlug() {
  // Use cryptographically secure random bytes — Math.random() is predictable.
  // 5 bytes -> base64url gives 7 URL-safe chars from a ~1 trillion space.
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export async function POST(req: NextRequest) {
  // -- Auth --------------------------------------------------------------------
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- Parse body ---------------------------------------------------------------
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, config, slug: preferredSlug, cohort_ids } = body;
  if (!config) return NextResponse.json({ error: 'config is required' }, { status: 400 });

  // Detect content type from config — platform only supports 'course' and 'event'
  const isCourse = config?.isCourse === true || config?.isCourse === 'true';
  const isEvent  = config?.eventDetails?.isEvent === true || config?.eventDetails?.isEvent === 'true';
  if (!isCourse && !isEvent) {
    return NextResponse.json({ error: 'config must set isCourse or eventDetails.isEvent' }, { status: 400 });
  }
  const content_type = isCourse ? 'course' : 'event';

  let attempt = 0;
  let slug = preferredSlug?.trim() || shortSlug();

  while (attempt < 3) {
    if (attempt > 0) slug = shortSlug();

    const { data, error } = await adminClient()
      .from('forms')
      .insert({ user_id: user.id, title, description, config, slug, content_type, cohort_ids: cohort_ids ?? [] })
      .select('id, slug, content_type')
      .single();

    if (!error) {
      return NextResponse.json({ id: data.id, slug: data.slug, content_type: data.content_type });
    }

    if (error.code === '23505') { attempt++; continue; }

    console.error('[api/forms] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  }

  return NextResponse.json(
    { error: 'Could not generate a unique URL. Try a custom slug.' },
    { status: 409 }
  );
}
