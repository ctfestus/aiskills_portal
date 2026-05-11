import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { blastEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const resend = new Resend(process.env.RESEND_API_KEY);

const TYPE_LABELS: Record<string, string> = {
  course: 'course',
  event: 'event',
  virtual_experience: 'virtual experience',
  announcement: 'announcement',
  assignment: 'assignment',
};

const TYPE_MESSAGES: Record<string, string> = {
  course: 'You have been enrolled in a new course. Log in to start learning.',
  event: 'You have been registered for an upcoming event. Mark your calendar.',
  virtual_experience: 'You have been assigned a new virtual experience. Jump in and get started.',
  announcement: 'A new announcement has been posted for you.',
  assignment: 'You have been assigned a new assignment. Log in to view the details and submit your work.',
};

const TYPE_CTA: Record<string, string> = {
  course: 'View Course',
  event: 'View Event',
  virtual_experience: 'View Virtual Experience',
  announcement: 'View Announcement',
  assignment: 'View Assignment',
};

/**
 * Fire-and-forget: sends assignment notification emails to all students
 * in the given cohorts. Errors are logged but never thrown.
 */
export async function sendAssignmentNotifications({
  cohortIds,
  title,
  slug,
  contentType,
  formUrl: formUrlOverride,
}: {
  cohortIds: string[];
  title: string;
  slug?: string;
  contentType: string;
  formUrl?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-assignment-notification] RESEND_API_KEY is not set -- emails will not be sent.');
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!cohortIds.length) return;

  try {
    const t        = await getTenantSettings();
    const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
    const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };

    const supabase = adminClient();
    const { data: students } = await supabase
      .from('students')
      .select('full_name, email')
      .in('cohort_id', cohortIds);

    if (!students?.length) return;

    const typeLabel   = TYPE_LABELS[contentType]   ?? contentType.replace(/_/g, ' ');
    const typeMessage = TYPE_MESSAGES[contentType] ?? 'You have been assigned new content.';
    const ctaLabel    = TYPE_CTA[contentType]      ?? 'View';
    const formUrl     = formUrlOverride != null
      ? (formUrlOverride.startsWith('http') ? formUrlOverride : `${t.appUrl}${formUrlOverride}`)
      : `${t.appUrl}/${slug}`;
    const subject     = `You've been assigned: ${title}`;

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
        const html = blastEmail({ subject, body, formTitle: title, formUrl, ctaLabel, senderName: t.senderName || t.teamName || t.appName, branding });
        return { from: FROM, to: email, subject, html };
      });
      await resend.batch.send(batch);
    }
  } catch (err) {
    console.error('[send-assignment-notification]', err);
    throw err;
  }
}
