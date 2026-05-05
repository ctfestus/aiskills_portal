import { Resend } from 'resend';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import {
  learningPathCertificateEmail,
  courseCompletedNextUpEmail,
  learningPathAssignedEmail,
} from '@/lib/email-templates';

export async function updateLearningPathProgress(
  supabase: any,
  studentId: string,
  completedItemId: string,
) {
  try {
    const { data: student } = await supabase.from('students').select('cohort_id').eq('id', studentId).single();
    if (!student?.cohort_id) return;

    const { data: paths } = await supabase
      .from('learning_paths')
      .select('id, item_ids, title, next_path_id')
      .eq('status', 'published')
      .contains('item_ids', [completedItemId])
      .contains('cohort_ids', [student.cohort_id]);

    if (!paths?.length) return;

    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const path of paths) {
      const { data: prog } = await supabase
        .from('learning_path_progress')
        .select('*')
        .eq('student_id', studentId)
        .eq('learning_path_id', path.id)
        .maybeSingle();

      const existingCompleted: string[] = prog?.completed_item_ids ?? [];
      if (existingCompleted.includes(completedItemId)) continue;

      const updatedCompleted = [...existingCompleted, completedItemId];
      const allDone = (path.item_ids ?? []).every((id: string) => updatedCompleted.includes(id));

      const upsertData: any = {
        student_id:         studentId,
        learning_path_id:   path.id,
        completed_item_ids: updatedCompleted,
        updated_at:         new Date().toISOString(),
      };
      if (allDone) upsertData.completed_at = new Date().toISOString();

      const { data: upserted } = await supabase
        .from('learning_path_progress')
        .upsert(upsertData, { onConflict: 'student_id,learning_path_id' })
        .select('id')
        .single();

      // Send "next up" email when a non-final item is completed
      if (!allDone) {
        const itemIds: string[] = path.item_ids ?? [];
        const completedIdx = itemIds.indexOf(completedItemId);
        const nextItemId   = completedIdx >= 0 && completedIdx + 1 < itemIds.length ? itemIds[completedIdx + 1] : null;
        if (nextItemId) {
          try {
            const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
            if (studentRow?.email) {
              const [{ data: courses }, { data: ves }] = await Promise.all([
                supabase.from('courses').select('id, title, slug, cover_image, description').in('id', [completedItemId, nextItemId]),
                supabase.from('virtual_experiences').select('id, title, slug, cover_image, description').in('id', [completedItemId, nextItemId]),
              ]);
              const itemMap: Record<string, any> = {};
              for (const c of courses ?? []) itemMap[c.id] = { ...c, isVE: false };
              for (const v of ves   ?? []) itemMap[v.id] = { ...v, isVE: true };
              const completedItem = itemMap[completedItemId];
              const nextItem      = itemMap[nextItemId];
              if (completedItem && nextItem) {
                const t    = await getTenantSettings();
                const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
                const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
                const nextUrl = nextItem.isVE
                  ? `${t.appUrl}/student?section=virtual_experiences`
                  : `${t.appUrl}/${nextItem.slug || nextItemId}?go=1`;
                await resend.emails.send({
                  from: FROM,
                  to:   studentRow.email,
                  subject: `You completed "${completedItem.title}" -- next up in ${path.title}`,
                  html: courseCompletedNextUpEmail({
                    name:            studentRow.full_name ?? 'there',
                    pathTitle:       path.title,
                    completedTitle:  completedItem.title,
                    completedNumber: completedIdx + 1,
                    totalItems:      itemIds.length,
                    nextTitle:       nextItem.title,
                    nextUrl,
                    nextCoverImage:  nextItem.cover_image ?? null,
                    nextIsVE:        nextItem.isVE,
                    nextDescription: nextItem.description ?? null,
                    branding,
                  }),
                });
              }
            }
          } catch (err) {
            console.error('[updateLearningPathProgress] next-up email failed', err);
          }
        }
      }

      // Auto-enroll student's cohort into next path when this path is completed
      if (allDone && path.next_path_id) {
        try {
          const { data: nextPath } = await supabase
            .from('learning_paths')
            .select('id, cohort_ids, title, description, item_ids')
            .eq('id', path.next_path_id)
            .single();
          if (nextPath) {
            const existingCohorts: string[] = nextPath.cohort_ids ?? [];
            if (!existingCohorts.includes(student.cohort_id)) {
              await supabase.from('learning_paths')
                .update({ cohort_ids: [...existingCohorts, student.cohort_id] })
                .eq('id', nextPath.id);
              const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
              if (studentRow?.email) {
                try {
                  const t    = await getTenantSettings();
                  const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
                  const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
                  const itemIds: string[] = nextPath.item_ids ?? [];
                  const [{ data: courseItems }, { data: veItems }] = itemIds.length
                    ? await Promise.all([
                        supabase.from('courses').select('id, title, cover_image, description').in('id', itemIds),
                        supabase.from('virtual_experiences').select('id, title, cover_image, description').in('id', itemIds),
                      ])
                    : [{ data: [] }, { data: [] }];
                  const itemMap: Record<string, any> = {};
                  for (const c of courseItems ?? []) itemMap[c.id] = { ...c, isVE: false };
                  for (const v of veItems     ?? []) itemMap[v.id] = { ...v, isVE: true };
                  const items = itemIds.map((id: string) => ({
                    title:       itemMap[id]?.title       ?? 'Untitled',
                    coverImage:  itemMap[id]?.cover_image ?? null,
                    isVE:        itemMap[id]?.isVE        ?? false,
                    description: itemMap[id]?.description ?? undefined,
                  }));
                  await resend.emails.send({
                    from: FROM,
                    to:   studentRow.email,
                    subject: `You've been enrolled in a new learning path: ${nextPath.title}`,
                    html: learningPathAssignedEmail({
                      name:            studentRow.full_name ?? 'there',
                      pathTitle:       nextPath.title,
                      pathDescription: nextPath.description ?? undefined,
                      dashboardUrl:    `${t.appUrl}/student?section=courses`,
                      items,
                      branding,
                    }),
                  });
                } catch (emailErr) {
                  console.error('[updateLearningPathProgress] next-path email failed', emailErr);
                }
              }
            }
          }
        } catch (nextErr) {
          console.error('[updateLearningPathProgress] next-path auto-enroll failed', nextErr);
        }
      }

      if (allDone && !prog?.cert_id) {
        const { data: studentRow } = await supabase.from('students').select('full_name, email').eq('id', studentId).single();
        const studentName = studentRow?.full_name ?? 'Student';

        const { data: pathCert } = await supabase.from('certificates').insert({
          course_id:        null,
          learning_path_id: path.id,
          student_name:     studentName,
          student_id:       studentId,
        }).select('id').single();

        if (pathCert?.id && upserted?.id) {
          await supabase.from('learning_path_progress')
            .update({ cert_id: pathCert.id })
            .eq('id', upserted.id);

          if (studentRow?.email) {
            try {
              const { data: fullPath } = await supabase
                .from('learning_paths')
                .select('title, description, item_ids')
                .eq('id', path.id)
                .single();

              const itemIds: string[] = fullPath?.item_ids ?? [];
              const [{ data: courseItems }, { data: veItems }] = await Promise.all([
                itemIds.length ? supabase.from('courses').select('id, title, cover_image, description').in('id', itemIds) : { data: [] },
                itemIds.length ? supabase.from('virtual_experiences').select('id, title, cover_image, description').in('id', itemIds) : { data: [] },
              ]);
              const itemMap: Record<string, any> = {};
              for (const c of courseItems ?? []) itemMap[c.id] = { ...c, isVE: false };
              for (const v of veItems     ?? []) itemMap[v.id] = { ...v, isVE: true };
              const items = itemIds.map((id: string) => {
                const item = itemMap[id];
                return {
                  title:       item?.title       ?? 'Untitled',
                  coverImage:  item?.cover_image ?? null,
                  isVE:        item?.isVE        ?? false,
                  description: item?.description ?? null,
                };
              });

              const t    = await getTenantSettings();
              const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
              const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
              const certUrl  = `${t.appUrl}/certificate/${pathCert.id}`;
              await resend.emails.send({
                from: FROM,
                to:   studentRow.email,
                subject: `Your Learning Path Certificate is ready: ${fullPath?.title ?? path.title}`,
                html: learningPathCertificateEmail({
                  name:      studentName,
                  pathTitle: fullPath?.title ?? path.title,
                  certUrl,
                  items,
                  branding,
                }),
              });
            } catch (emailErr) {
              console.error('[updateLearningPathProgress] cert email failed', emailErr);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[updateLearningPathProgress]', err);
  }
}
