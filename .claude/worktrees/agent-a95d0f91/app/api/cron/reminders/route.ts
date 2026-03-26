import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Called hourly by Vercel Cron. Sends 24hr and 1hr event reminders.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: forms } = await supabase
    .from('forms')
    .select('id, slug, config')
    .not('config->eventDetails', 'is', null);

  if (!forms?.length) return NextResponse.json({ sent: 0 });

  const baseUrl = process.env.APP_URL || 'https://festforms.com';
  const now = new Date();
  let sent = 0;

  for (const form of forms) {
    const event = form.config?.eventDetails;
    if (!event?.isEvent) continue;
    const eventBannerUrl = form.config?.coverImage
      ? (/^https?:\/\//i.test(form.config.coverImage)
          ? form.config.coverImage
          : `${baseUrl}/api/og/${form.id}`)
      : undefined;

    // Parse event date — prefer ISO, fallback to human string
    const rawDate = event.dateISO || event.date;
    if (!rawDate) continue;
    const eventDate = new Date(rawDate);
    if (isNaN(eventDate.getTime())) continue;

    const diffMs = eventDate.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    // 24hr window: 23.75–24.25hr before event
    // 1hr window:  0.75–1.25hr before event
    const is24hr = diffHrs >= 23.75 && diffHrs <= 24.25;
    const is1hr  = diffHrs >= 0.75  && diffHrs <= 1.25;
    if (!is24hr && !is1hr) continue;

    const { data: responses } = await supabase
      .from('responses')
      .select('data')
      .eq('form_id', form.id);

    const emails = (responses ?? [])
      .map((r: any) => r.data?.email)
      .filter((e: any): e is string => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (!emails.length) continue;

    await fetch(`${baseUrl}/api/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({
        type: 'reminder',
        to: emails,
        data: {
          eventTitle: form.config.title,
          eventDate: event.date,
          eventTime: event.time,
          eventLocation: event.location,
          eventTimezone: event.timezone,
          meetingLink: event.eventType === 'virtual' ? event.meetingLink : undefined,
          bannerUrl: eventBannerUrl,
          formUrl: `${baseUrl}/${form.slug || form.id}`,
          isOneHour: is1hr,
        },
      }),
    });

    sent += emails.length;
  }

  return NextResponse.json({ success: true, sent });
}
