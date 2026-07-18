import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchSend = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
  Resend: class {
    batch = { send: batchSend };
    emails = { send: vi.fn(() => { throw new Error('individual send must not be used'); }) };
  },
}));
vi.mock('@/lib/get-tenant-settings', () => ({
  getTenantSettings: vi.fn().mockResolvedValue({
    senderName: 'Team', supportEmail: 'team@example.com', logoUrl: '', emailBannerUrl: '',
    teamName: 'Team', appName: 'App', appUrl: 'https://example.com',
  }),
}));
vi.mock('@/lib/email-templates', () => ({ learningPathAssignedEmail: vi.fn(() => '<p>assigned</p>') }));

import { sendPathNotification } from '@/lib/send-path-notification';
import { makeSupabaseStub } from '../helpers/supabaseStub';

function studentRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${String(index).padStart(4, '0')}`,
    full_name: `Student ${index}`,
    email: `student${index}@example.com`,
  }));
}

const path = { id: 'lp1', title: 'Path', description: 'Learn', item_ids: [] };

beforeEach(() => {
  vi.useRealTimers();
  batchSend.mockReset();
  batchSend.mockResolvedValue({ data: [{ id: 'email1' }], error: null });
  process.env.RESEND_API_KEY = 'test-key';
});

describe('sendPathNotification', () => {
  it('uses Resend batches of at most 100 recipients with deterministic idempotency keys', async () => {
    const db = makeSupabaseStub({ students: { data: studentRows(205), error: null } });

    await expect(sendPathNotification(db as any, path, ['co1'])).resolves.toEqual({
      total: 205, sent: 205, failed: 0,
    });

    expect(batchSend).toHaveBeenCalledTimes(3);
    expect(batchSend.mock.calls.map(call => call[0].length)).toEqual([100, 100, 5]);
    const keys = batchSend.mock.calls.map(call => call[1]?.idempotencyKey);
    expect(keys.every(key => typeof key === 'string' && key.startsWith('learning-path/lp1/'))).toBe(true);
    expect(new Set(keys).size).toBe(3);
  });

  it('backs off and retries a 429 batch with the same idempotency key', async () => {
    vi.useFakeTimers();
    batchSend
      .mockResolvedValueOnce({ data: null, error: { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests' } })
      .mockResolvedValueOnce({ data: [{ id: 'email1' }], error: null });
    const db = makeSupabaseStub({ students: { data: studentRows(2), error: null } });

    const resultPromise = sendPathNotification(db as any, path, ['co1']);
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ total: 2, sent: 2, failed: 0 });
    expect(batchSend).toHaveBeenCalledTimes(2);
    expect(batchSend.mock.calls[0][1]?.idempotencyKey).toBe(batchSend.mock.calls[1][1]?.idempotencyKey);
  });

  it('reports a rejected batch without turning the saved path into an exception', async () => {
    batchSend.mockResolvedValue({
      data: null,
      error: { statusCode: 422, name: 'validation_error', message: 'Rejected' },
    });
    const db = makeSupabaseStub({ students: { data: studentRows(3), error: null } });

    await expect(sendPathNotification(db as any, path, ['co1'])).resolves.toEqual({
      total: 3, sent: 0, failed: 3,
    });
  });
});
