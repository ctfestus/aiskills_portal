import { describe, expect, it } from 'vitest';
import { safeVeUploadName, validateVeSubmissionFile, VE_SUBMISSION_MAX_BYTES } from '@/lib/ve-upload';

describe('virtual experience upload validation', () => {
  it('accepts supported work files', () => expect(validateVeSubmissionFile(new File(['ok'], 'analysis.xlsx'))).toBeNull());
  it('rejects unsupported and oversized files', () => {
    expect(validateVeSubmissionFile(new File(['x'], 'malware.exe'))).toMatch(/not supported/i);
    const oversized = new File([new Uint8Array(VE_SUBMISSION_MAX_BYTES + 1)], 'large.pdf');
    expect(validateVeSubmissionFile(oversized)).toMatch(/25 MB/i);
  });
  it('creates storage-safe names', () => expect(safeVeUploadName('My final report (v2).pdf')).toBe('My-final-report-v2-.pdf'));
});
