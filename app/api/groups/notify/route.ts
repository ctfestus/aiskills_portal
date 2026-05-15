import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { Resend } from 'resend';
import { groupAssignedEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

async function getStaffUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getStaffUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { group_id } = body as { group_id?: string };
  if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 });

  const supabase = adminClient();
  const [{ data: group }, settings] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, description, cohort_id, cohorts(name), group_members(student_id, is_leader, students(id, full_name, email))')
      .eq('id', group_id)
      .single(),
    getTenantSettings(),
  ]);

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const members = (group.group_members as any[]) ?? [];
  if (members.length === 0) return NextResponse.json({ sent: 0 });

  const cohortName = (group.cohorts as any)?.name ?? '';
  const dashboardUrl = `${settings.appUrl}/student`;
  const fromEmail = process.env.RESEND_FROM_EMAIL || `${settings.senderName} <${settings.supportEmail}>`;
  const branding = {
    logoUrl:       settings.logoUrl,
    emailBannerUrl: settings.emailBannerUrl,
    teamName:      settings.teamName,
    appName:       settings.appName,
    appUrl:        settings.appUrl,
  };

  const memberList = members.map((m: any) => ({
    full_name: m.students?.full_name ?? 'Member',
    is_leader: m.is_leader ?? false,
  }));

  let sent = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    const emails: { from: string; to: string; subject: string; html: string }[] = [];

    for (const m of batch) {
      const student = m.students as any;
      if (!student?.email) continue;

      const dedupeKey = `group-notify-${group_id}-${student.id}`;
      // Skip only if already successfully sent (pending = previous attempt failed, retry is allowed)
      const { data: existing } = await supabase
        .from('email_dedup')
        .select('id')
        .eq('dedupe_key', dedupeKey)
        .eq('type', 'group_assigned')
        .eq('status', 'sent')
        .maybeSingle();
      if (existing) continue;

      // Upsert to pending (overwrites any stale pending from a previous failed attempt)
      await supabase.from('email_dedup').upsert(
        { dedupe_key: dedupeKey, type: 'group_assigned', status: 'pending' },
        { onConflict: 'dedupe_key,type', ignoreDuplicates: false }
      );

      emails.push({
        from: fromEmail,
        to: student.email,
        subject: `You have been added to ${group.name}`,
        html: groupAssignedEmail({
          recipientName: student.full_name ?? 'there',
          groupName: group.name,
          cohortName,
          description: group.description ?? undefined,
          members: memberList,
          dashboardUrl,
          branding,
        }),
      });
    }

    if (emails.length === 0) continue;

    const { error: sendError } = await resend.batch.send(emails);
    if (sendError) {
      return NextResponse.json({ error: `Email send failed: ${(sendError as any).message ?? sendError}`, sent }, { status: 500 });
    }
    sent += emails.length;
    const keys = emails.map(e => {
      const member = batch.find((m: any) => m.students?.email === e.to);
      return `group-notify-${group_id}-${member?.students?.id}`;
    }).filter(Boolean);
    await supabase
      .from('email_dedup')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .in('dedupe_key', keys)
      .eq('type', 'group_assigned');
  }

  return NextResponse.json({ sent });
}
