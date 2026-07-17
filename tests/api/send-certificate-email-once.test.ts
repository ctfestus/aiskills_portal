import { beforeEach, describe, expect, it, vi } from 'vitest';

// sendCertificateEmailOnce must be at-most-once AND recoverable:
// - a provider error releases the pending lock (and propagates) so the next run retries;
// - a pending lock left by a crashed sender is reclaimed once stale;
// - a fresh pending lock (live sender) is never stolen;
// - a 'sent' lock is never resent.
// Returns true only when the email is settled -- learning-path completion gates its
// commit marker on that.

const sendSpy = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({ Resend: class { emails = { send: sendSpy }; } }));

import { sendCertificateEmailOnce } from '@/lib/issue-certificate';
import { makeSupabaseStub } from '../helpers/supabaseStub';

const args = { certId: 'certA', dedupeType: 'test-email', from: 'a@x.co', to: 'b@x.co', subject: 'S', html: '<p>x</p>' };

beforeEach(() => {
  sendSpy.mockReset();
  sendSpy.mockResolvedValue({ data: { id: 'e1' }, error: null });
  process.env.RESEND_API_KEY = 'test-key';
});

describe('sendCertificateEmailOnce recovery', () => {
  it('releases the pending lock and rethrows on a thrown provider error, so a retry sends', async () => {
    sendSpy.mockRejectedValueOnce(new Error('provider down'));
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: null },   // attempt 1: lock acquired
        { data: null, error: null },   // attempt 1: lock released after the send failed
        { data: null, error: null },   // attempt 2: lock re-acquired (row was deleted)
        { data: null, error: null },   // attempt 2: mark sent
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).rejects.toThrow('provider down');
    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(2); // failed attempt + successful retry
    // Deterministic idempotency key: Resend drops a resend of an email it already accepted.
    expect(sendSpy.mock.calls[0][1]).toMatchObject({ idempotencyKey: 'test-email/certA' });
  });

  it('treats a RESOLVED { error } from the Resend SDK as a failed send, not a success', async () => {
    // The SDK reports API failures by resolving, not throwing -- marking this "sent"
    // would silently lose the email forever. It must release the lock and surface the
    // failure so the next reconciliation retries.
    sendSpy.mockResolvedValueOnce({ data: null, error: { name: 'application_error', message: 'provider down' } });
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: null },   // attempt 1: lock acquired
        { data: null, error: null },   // attempt 1: lease released (delete) -- never marked sent
        { data: null, error: null },   // attempt 2: lock re-acquired
        { data: null, error: null },   // attempt 2: mark sent
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).rejects.toThrow('provider down');
    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(2); // failed attempt + successful retry
  });

  it('reclaims a stale pending lock from a crashed sender and sends', async () => {
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: { code: '23505' } },      // lock exists
        { data: { status: 'pending' }, error: null },  // still pending
        { data: [{ id: 'd1' }], error: null },         // stale -- reclaim succeeds
        { data: null, error: null },                   // mark sent
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('does not steal a fresh pending lock from a live sender', async () => {
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: { code: '23505' } },      // lock exists
        { data: { status: 'pending' }, error: null },  // still pending
        { data: [], error: null },                     // too fresh -- reclaim matched nothing
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('never resends once the lock is marked sent', async () => {
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: { code: '23505' } },   // lock exists
        { data: { status: 'sent' }, error: null },  // already delivered
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(true);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('remains unsettled when saving the sent status fails', async () => {
    const db = makeSupabaseStub({
      email_dedup: [
        { data: null, error: null },                         // lock acquired
        { data: null, error: { message: 'database down' } }, // mark-sent failed
      ],
    });

    await expect(sendCertificateEmailOnce(db as any, args)).resolves.toBe(false);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});
