import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { blastEmail } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

const TYPE_LABELS: Record<string, string> = {
  course: 'course',
  event: 'event',
  virtual_experience: 'virtual experience',
  announcement: 'announcement',
};

const TYPE_MESSAGES: Record<string, string> = {
  course: 'You have been enrolled in a new course. Log in to start learning.',
  event: 'You have been registered for an upcoming event. Mark your calendar.',
  virtual_experience: 'You have been assigned a new virtual experience. Jump in and get started.',
  announcement: 'A new announcement has been posted for you.',
};

const TYPE_CTA: Record<string, string> = {
  course: 'View Course',
  event: 'View Event',
  virtual_experience: 'View Virtual Experience',
  announcement: 'View Announcement',
};

const SENDER = 'AI Skills Africa - Learning Experience Team';

/**
 * Fire-and-forget: sends assignment notification emails to all students
 * in the given cohorts. Errors are logged but never thrown.
 */
export async function sendAssignmentNotifications({
  cohortIds,
  title,
  slug,
  contentType,
}: {
  cohortIds: string[];
  title: string;
  slug: string;
  contentType: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  if (!cohortIds.length) return;

  try {
    const supabase = adminClient();
    const { data: students } = await supabase
      .from('students')
      .select('full_name, email')
      .in('cohort_id', cohortIds);

    if (!students?.length) return;

    const typeLabel = TYPE_LABELS[contentType] ?? contentType.replace(/_/g, ' ');
    const typeMessage = TYPE_MESSAGES[contentType] ?? 'You have been assigned new content.';
    const ctaLabel = TYPE_CTA[contentType] ?? 'View';
    const formUrl = `${APP_URL}/${slug}`;
    const subject = `You've been assigned: ${title}`;

    // Deduplicate by email
    const seen = new Set<string>();
    const recipients: { email: string; name: string }[] = [];
    for (const s of students) {
      const email = (s.email ?? '').trim().toLowerCase();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !seen.has(email)) {
        seen.add(email);
        recipients.push({ email, name: s.full_name || 'there' });
      }
    }

    if (!recipients.length) return;

    // Send in batches of 100 (Resend limit)
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100).map(({ email, name }) => {
        const body = `Hi ${name},\n\n${typeMessage}\n\n<b>${title}</b>\n\nClick the button below to open your ${typeLabel}.`;
        const html = blastEmail({ subject, body, formTitle: title, formUrl, ctaLabel, senderName: SENDER });
        return { from: FROM, to: email, subject, html };
      });
      await resend.batch.send(batch);
    }
  } catch (err) {
    console.error('[send-assignment-notification]', err);
  }
}
