// Shared, content-agnostic certificate issuance primitives.
//
// The `certificates` table is polymorphic (course_id | ve_id | learning_path_id | certification_id),
// so issuing a certificate is the same operation regardless of what was passed: insert one active
// row per (content, student), optionally award a content badge, and email the recipient exactly once.
// Both app/api/course/route.ts and app/api/certification-attempt/route.ts compose these helpers so the
// race-safety, badge-award, and email-dedup logic lives in one place.

import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

type Admin = SupabaseClient<any, 'public', any>;

// Which polymorphic content column the certificate hangs off.
export type CertColumn = 'course_id' | 've_id' | 'learning_path_id' | 'certification_id';

// Insert (or fetch the existing) active certificate for a (content, student) pair. Race-safe:
// a concurrent insert that wins the partial-unique index is re-read rather than surfaced as an error.
export async function ensureCertificate(
  supabase: Admin,
  { column, contentId, studentId, studentName }:
    { column: CertColumn; contentId: string; studentId: string; studentName: string },
): Promise<{ certId: string; isNew: boolean }> {
  const { data: existing } = await supabase
    .from('certificates').select('id')
    .eq(column, contentId).eq('student_id', studentId).eq('revoked', false)
    .maybeSingle();
  if (existing?.id) return { certId: existing.id, isNew: false };

  const { data: cert, error } = await supabase
    .from('certificates')
    .insert({ [column]: contentId, student_id: studentId, student_name: studentName.trim() })
    .select('id').single();

  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('certificates').select('id')
        .eq(column, contentId).eq('student_id', studentId).eq('revoked', false)
        .maybeSingle();
      if (raced?.id) return { certId: raced.id, isNew: false };
    }
    throw error;
  }
  return { certId: cert.id, isNew: true };
}

// Upsert a content badge and award it to the student. Idempotent on both tables.
export async function awardContentBadge(
  supabase: Admin,
  { badgeId, name, description, imageUrl, category, studentId }:
    { badgeId: string; name: string; description: string; imageUrl: string; category: string; studentId: string },
): Promise<void> {
  const { error: badgesErr } = await supabase.from('badges').upsert({
    id: badgeId, name, description, icon: 'graduated', color: '#6366f1', image_url: imageUrl, category,
  }, { onConflict: 'id' });
  if (badgesErr) { console.error('[awardContentBadge] badges upsert failed', badgesErr); return; }

  const { error: studentBadgesErr } = await supabase.from('student_badges')
    .upsert({ student_id: studentId, badge_id: badgeId }, { onConflict: 'student_id,badge_id', ignoreDuplicates: true });
  if (studentBadgesErr) console.error('[awardContentBadge] student_badges upsert failed', studentBadgesErr);
}

// Send a certificate email at most once, using email_dedup as an insert-as-lock keyed by the cert id.
// On 23505 a prior caller already holds the lock: 'sent' = done; otherwise the prior holder crashed
// before sending -- logged so the stale row can be cleared and the next call re-acquires.
export async function sendCertificateEmailOnce(
  supabase: Admin,
  { certId, dedupeType, from, to, subject, html }:
    { certId: string; dedupeType: string; from: string; to: string; subject: string; html: string },
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { error: lockErr } = await supabase.from('email_dedup')
    .insert({ dedupe_key: certId, type: dedupeType });
  if (lockErr) {
    if (lockErr.code === '23505') {
      const { data: existing } = await supabase.from('email_dedup')
        .select('status').eq('dedupe_key', certId).eq('type', dedupeType).maybeSingle();
      if (existing?.status !== 'sent') {
        console.error('[sendCertificateEmailOnce] stale pending lock -- email may not have been sent, delete the email_dedup row to unblock', { certId, dedupeType });
      }
    } else {
      console.error('[sendCertificateEmailOnce] email_dedup lock failed', lockErr);
    }
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html });

  const { error: markSentErr } = await supabase.from('email_dedup')
    .update({ status: 'sent' }).eq('dedupe_key', certId).eq('type', dedupeType);
  if (markSentErr) console.error('[sendCertificateEmailOnce] email_dedup mark-sent failed', markSentErr);
}
