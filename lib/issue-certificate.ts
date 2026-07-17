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

// A 'pending' email_dedup lock older than this belongs to a sender that crashed mid-send;
// younger pending locks are presumed live (a real send settles in seconds) and left alone.
const STALE_EMAIL_LOCK_MINUTES = 15;

// Send a certificate email at most once, using email_dedup as an insert-as-lock keyed by the
// cert id (or any stable dedupe key). Recovery-safe:
// - provider failure: Resend reports API errors by RESOLVING with { error } (it does not
//   throw), so both shapes are treated as a failed send -- the pending lock is released
//   before the error propagates, and the caller's next run can retry;
// - crashed sender: a pending lock older than STALE_EMAIL_LOCK_MINUTES is reclaimed via a
//   conditional update -- the row lock serializes rival reclaimers, the loser's filter
//   re-evaluates against the refreshed sent_at and matches nothing;
// - lease ownership: sent_at doubles as a client-generated lease token; release and
//   mark-sent are scoped to OUR token, so a sender that outlived the staleness window
//   cannot delete or complete a lock someone else has since reclaimed;
// - duplicate delivery: the deterministic Resend idempotency key makes a resend after a
//   crash-between-accept-and-mark-sent a no-op at the provider (keys are held ~24h);
// - 'sent' is final: never resent.
// Returns true when the email is settled (sent now, sent previously, or email disabled) and
// false when a fresh pending lock is held by another live sender -- callers that gate a
// commit marker on the email (learning-path completion) must NOT finalize on false.
export async function sendCertificateEmailOnce(
  supabase: Admin,
  { certId, dedupeType, from, to, subject, html }:
    { certId: string; dedupeType: string; from: string; to: string; subject: string; html: string },
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return true;

  const leaseToken = new Date().toISOString();

  const { error: lockErr } = await supabase.from('email_dedup')
    .insert({ dedupe_key: certId, type: dedupeType, sent_at: leaseToken });
  if (lockErr) {
    if (lockErr.code !== '23505') {
      console.error('[sendCertificateEmailOnce] email_dedup lock failed', lockErr);
      return false;
    }
    const { data: existing } = await supabase.from('email_dedup')
      .select('status').eq('dedupe_key', certId).eq('type', dedupeType).maybeSingle();
    if (existing?.status === 'sent') return true;

    // Pending lock from another run: take over its lease only when stale.
    const cutoff = new Date(Date.now() - STALE_EMAIL_LOCK_MINUTES * 60_000).toISOString();
    const { data: reclaimed } = await supabase.from('email_dedup')
      .update({ sent_at: leaseToken })
      .eq('dedupe_key', certId).eq('type', dedupeType)
      .eq('status', 'pending').lt('sent_at', cutoff)
      .select('id');
    if (!(reclaimed ?? []).length) return false; // fresh lock -- its sender is presumed live
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendApiErr } = await resend.emails.send(
      { from, to, subject, html },
      { idempotencyKey: `${dedupeType}/${certId}` },
    );
    if (sendApiErr) throw new Error(`Resend send failed: ${sendApiErr.name ?? ''} ${sendApiErr.message ?? ''}`.trim());
  } catch (sendErr) {
    // Release OUR lease so the next run can retry, then surface the failure to the caller.
    const { error: releaseErr } = await supabase.from('email_dedup')
      .delete()
      .eq('dedupe_key', certId).eq('type', dedupeType)
      .eq('status', 'pending').eq('sent_at', leaseToken);
    if (releaseErr) console.error('[sendCertificateEmailOnce] failed to release pending lock', releaseErr);
    throw sendErr;
  }

  // Scoped to our lease: if another sender reclaimed the lock meanwhile, completion is theirs.
  const { error: markSentErr } = await supabase.from('email_dedup')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('dedupe_key', certId).eq('type', dedupeType)
    .eq('status', 'pending').eq('sent_at', leaseToken);
  if (markSentErr) {
    console.error('[sendCertificateEmailOnce] email_dedup mark-sent failed', markSentErr);
    return false;
  }
  return true;
}
