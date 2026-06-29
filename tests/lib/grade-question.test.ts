import { describe, it, expect } from 'vitest';

import { gradeQuestion, signProof, verifyProof } from '@/lib/grade-question';

// gradeQuestion is the single source of truth shared by the course and certification attempt
// routes, so these cover each question type's pass/fail and the Python proof binding.

const grade = (q: any, answer: any, extra: any = {}) =>
  gradeQuestion(q, { storedAnswers: { [q.id]: answer }, ...extra });

describe('gradeQuestion', () => {
  it('returns false when there is no stored answer', () => {
    expect(gradeQuestion({ id: 'q', type: 'multiple_choice', correctAnswer: 'A' }, { storedAnswers: {} })).toBe(false);
  });

  it('multiple_choice / code / default: exact match on correctAnswer', () => {
    expect(grade({ id: 'q', type: 'multiple_choice', correctAnswer: 'A' }, 'A')).toBe(true);
    expect(grade({ id: 'q', type: 'multiple_choice', correctAnswer: 'A' }, 'B')).toBe(false);
    expect(grade({ id: 'q', type: 'code', correctAnswer: 'x' }, 'x')).toBe(true);
  });

  it('fill_blank: case-insensitive, trimmed, pipe-separated alternatives', () => {
    const q = { id: 'q', type: 'fill_blank', correctAnswer: 'COUNT(*)|count(*)' };
    expect(grade(q, ' count(*) ')).toBe(true);
    expect(grade(q, 'COUNT(*)')).toBe(true);
    expect(grade(q, 'sum(*)')).toBe(false);
  });

  it('fill_blank: multiple inline blanks (||| between blanks, | for alternatives)', () => {
    const q = { id: 'q', type: 'fill_blank', correctAnswer: 'corr|correlation|||sqft' };
    expect(grade(q, 'corr|||sqft')).toBe(true);
    expect(grade(q, 'CORRELATION|||SQFT')).toBe(true);  // case-insensitive per blank
    expect(grade(q, 'corr|||price')).toBe(false);        // second blank wrong
    expect(grade(q, 'corr')).toBe(false);                // a blank left unanswered
  });

  it('arrange: exact match on the joined order string', () => {
    const q = { id: 'q', type: 'arrange', correctAnswer: 'a|||b|||c' };
    expect(grade(q, 'a|||b|||c')).toBe(true);
    expect(grade(q, 'b|||a|||c')).toBe(false);
  });

  it('review types: only the "completed" sentinel passes', () => {
    expect(grade({ id: 'q', type: 'code_review' }, 'completed')).toBe(true);
    expect(grade({ id: 'q', type: 'document_review' }, 'failed')).toBe(false);
  });

  it('sql_exercise: passed only when not skipped / solutionViewed', () => {
    const q = { id: 'q', type: 'sql_exercise' };
    expect(grade(q, JSON.stringify({ passed: true }))).toBe(true);
    expect(grade(q, JSON.stringify({ passed: true, solutionViewed: true }))).toBe(false);
    expect(grade(q, JSON.stringify({ passed: true, skipped: true }))).toBe(false);
    expect(grade(q, JSON.stringify({ passed: false }))).toBe(false);
  });

  it('python_exercise: requires a valid proof when a verifier is supplied', () => {
    const q = { id: 'q', type: 'python_exercise' };
    const proof = signProof('cert-1', 'q', '42');
    const verify = (qid: string, output: string, p: unknown) => verifyProof('cert-1', qid, output, p);

    expect(grade(q, JSON.stringify({ passed: true, output: '42', proof }), { verifyProof: verify })).toBe(true);
    // Proof minted for a different content id must not validate (replay protection).
    const otherVerify = (qid: string, output: string, p: unknown) => verifyProof('cert-2', qid, output, p);
    expect(grade(q, JSON.stringify({ passed: true, output: '42', proof }), { verifyProof: otherVerify })).toBe(false);
    // Tampered output invalidates the proof.
    expect(grade(q, JSON.stringify({ passed: true, output: '99', proof }), { verifyProof: verify })).toBe(false);
  });

  it('python_exercise: proof is bound to the attempt id (no cross-attempt reuse)', () => {
    const q = { id: 'q', type: 'python_exercise' };
    const proof = signProof('cert-1', 'q', '42', 'attempt-1');
    const verifyA1 = (qid: string, output: string, p: unknown) => verifyProof('cert-1', qid, output, p, 'attempt-1');
    const verifyA2 = (qid: string, output: string, p: unknown) => verifyProof('cert-1', qid, output, p, 'attempt-2');
    expect(grade(q, JSON.stringify({ passed: true, output: '42', proof }), { verifyProof: verifyA1 })).toBe(true);
    // A proof from attempt-1 must not validate against a later attempt-2 (retake replay protection).
    expect(grade(q, JSON.stringify({ passed: true, output: '42', proof }), { verifyProof: verifyA2 })).toBe(false);
  });

  it('python_exercise: persisted skipped/solutionViewed stays sticky', () => {
    const q = { id: 'q', type: 'python_exercise' };
    const proof = signProof('cert-1', 'q', '42');
    const verify = (qid: string, output: string, p: unknown) => verifyProof('cert-1', qid, output, p);
    expect(gradeQuestion(q, {
      storedAnswers: { q: JSON.stringify({ passed: true, output: '42', proof }) },
      persistedAnswers: { q: JSON.stringify({ solutionViewed: true }) },
      verifyProof: verify,
    })).toBe(false);
  });
});
