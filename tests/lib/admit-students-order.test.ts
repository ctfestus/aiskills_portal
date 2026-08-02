import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// This is a sequencing invariant across external systems: an existing blocked account
// must not be released until its enrollment has been validated or activated. Keeping a
// source-level guard here catches an accidental move of the transition back above the
// activation block without requiring live Supabase and Resend services.
describe('student admission sequencing', () => {
  it('releases account access only after enrollment activation', () => {
    const source = readFileSync(join(process.cwd(), 'lib', 'admit-students.ts'), 'utf8');
    const provisionStart = source.indexOf('async function provisionStudentAccount');
    const activation = source.indexOf('await activateEnrollment', provisionStart);
    const newAccountRelease = source.indexOf('await markAdmissionsProvisioned', provisionStart);
    const existingAccountRelease = source.indexOf('await markExistingAccountAdmitted', provisionStart);

    expect(activation).toBeGreaterThan(provisionStart);
    expect(newAccountRelease).toBeGreaterThan(activation);
    expect(existingAccountRelease).toBeGreaterThan(activation);
  });

  it('keeps enrollment activation resumable after a partial first attempt', () => {
    const source = readFileSync(join(process.cwd(), 'lib', 'db-payments.ts'), 'utf8');
    const start = source.indexOf('export async function activateEnrollment');
    const end = source.indexOf('// ---\n// recordPayment', start);
    const activation = source.slice(start, end);

    expect(activation).toContain("select('id, student_id,");
    expect(activation).not.toContain(".is('student_id', null)");
    expect(activation).toContain('existingInstallments');
    expect(activation).toContain('initialAmountRemaining');
  });
});
