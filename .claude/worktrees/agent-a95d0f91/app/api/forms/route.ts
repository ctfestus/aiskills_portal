import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function shortSlug() {
  // Use cryptographically secure random bytes — Math.random() is predictable.
  // 5 bytes → base64url gives 7 URL-safe chars from a ~1 trillion space.
  return randomBytes(5).toString('base64url').slice(0, 7).toLowerCase();
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, config, slug: preferredSlug } = body;
  if (!config) return NextResponse.json({ error: 'config is required' }, { status: 400 });

  // ── Insert with slug retry (up to 3 attempts on collision) ──────────────────
  // The BEFORE INSERT trigger enforces plan limits atomically — no separate
  // check needed here. If the limit is exceeded, Postgres raises P0001 which
  // PostgREST surfaces as error code "P0001".
  let attempt = 0;
  let slug = preferredSlug?.trim() || shortSlug();

  while (attempt < 3) {
    if (attempt > 0) slug = shortSlug(); // regenerate on collision

    const { data, error } = await adminClient()
      .from('forms')
      .insert({ user_id: user.id, title, description, config, slug })
      .select('id, slug')
      .single();

    if (!error) {
      return NextResponse.json({ id: data.id, slug: data.slug });
    }

    // Slug collision — retry
    if (error.code === '23505') { attempt++; continue; }

    // Plan limit reached — trigger raised P0001
    if (error.code === 'P0001' || error.message?.includes('limit_reached')) {
      const resource = (config?.isCourse === true || config?.isCourse === 'true')
        ? 'course'
        : (config?.eventDetails?.isEvent === true || config?.eventDetails?.isEvent === 'true')
        ? 'event'
        : 'form';

      const messages: Record<string, string> = {
        course: 'Course creation is not available on the free plan. Upgrade to Pro to create courses.',
        form:   'You\'ve reached the free plan limit of 2 forms. Upgrade to Pro for unlimited forms.',
        event:  'You\'ve reached the free plan limit of 2 events. Upgrade to Pro for unlimited events.',
      };
      return NextResponse.json(
        { error: messages[resource] },
        { status: 403 }
      );
    }

    // Any other error
    console.error('[api/forms] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save form.' }, { status: 500 });
  }

  return NextResponse.json(
    { error: 'Could not generate a unique URL. Try a custom slug.' },
    { status: 409 }
  );
}
