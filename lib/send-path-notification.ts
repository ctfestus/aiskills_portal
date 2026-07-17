import { Resend } from 'resend';
import { learningPathAssignedEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPathNotification(
  supabase: any,
  lp: { id: string; title: string; description?: string | null; item_ids?: string[] },
  cohortIds: string[],
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-path-notification] RESEND_API_KEY is not set.');
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!cohortIds.length) return;

  const itemIds: string[] = lp.item_ids ?? [];
  const [{ data: coursesRaw }, { data: vesRaw }, { data: certsRaw }] = itemIds.length
    ? await Promise.all([
        supabase.from('courses').select('id, title, cover_image').in('id', itemIds),
        supabase.from('virtual_experiences').select('id, title, cover_image').in('id', itemIds),
        supabase.from('certifications').select('id, title, cover_image').in('id', itemIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const contentMap: Record<string, any> = {};
  for (const c of coursesRaw ?? []) contentMap[c.id] = { ...c, content_type: 'course' };
  for (const v of vesRaw     ?? []) contentMap[v.id] = { ...v, content_type: 'virtual_experience' };
  for (const x of certsRaw   ?? []) contentMap[x.id] = { ...x, content_type: 'certification' };

  const items = itemIds.map((id: string) => {
    const f = contentMap[id];
    return {
      title:       f?.title ?? 'Untitled',
      coverImage:  f?.cover_image ?? null,
      isVE:        f?.content_type === 'virtual_experience',
      isCert:      f?.content_type === 'certification',
      description: undefined as string | undefined,
    };
  });

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, email')
    .in('cohort_id', cohortIds)
    .eq('role', 'student');

  if (!students?.length) return;

  const t            = await getTenantSettings();
  const FROM         = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
  const branding     = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
  // The student dashboard routes by URL hash, not a section query parameter.
  const dashboardUrl = `${t.appUrl}/student#learning_paths`;

  const failures: string[] = [];

  for (const student of students) {
    if (!student.email) continue;
    try {
      // Resend reports API failures by resolving with { error }, not by throwing --
      // count both shapes as failures so the caller's "emails failed" response is honest.
      const { error: sendErr } = await resend.emails.send({
        from: FROM,
        to:   student.email,
        subject: `You've been enrolled in a new learning path: ${lp.title}`,
        html: learningPathAssignedEmail({
          name:            student.full_name ?? 'there',
          pathTitle:       lp.title,
          pathDescription: lp.description ?? undefined,
          items,
          dashboardUrl,
          branding,
        }),
      });
      if (sendErr) throw new Error(`${sendErr.name ?? ''} ${sendErr.message ?? 'send failed'}`.trim());
    } catch (err) {
      console.error(`[send-path-notification] failed to email ${student.email}:`, err);
      failures.push(student.email);
    }
  }

  if (failures.length) {
    throw new Error(`[send-path-notification] ${failures.length} email(s) failed to send.`);
  }
}
