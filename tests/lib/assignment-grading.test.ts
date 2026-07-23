import { describe, it, expect } from 'vitest';

import {
  suggestGrade,
  buildFeedbackFromReport,
  ASSIGNMENT_PASS_MARK,
  type SubmissionForGrading,
} from '@/lib/assignment-grading';

// A submission carrying the canonical review envelope in response_text.
function withReview(report: unknown, extra: Partial<SubmissionForGrading> = {}): SubmissionForGrading {
  return {
    id: 's1',
    status: 'submitted',
    response_text: JSON.stringify({ type: 'document_review', count: 1, submittedAt: '2026-01-01', report }),
    student: { full_name: 'Ama', email: 'ama@example.com' },
    ...extra,
  };
}

describe('suggestGrade', () => {
  it('reads overallScore from a stored AI review and marks pass at >= 85', () => {
    const s = suggestGrade(withReview({ overallScore: 88, executiveSummary: 'Strong work.' }));
    expect(s.source).toBe('ai-review');
    expect(s.suggestedScore).toBe(88);
    expect(s.passed).toBe(true);
    expect(s.feedback).toContain('88/100');
    expect(s.feedback).toContain('Strong work.');
  });

  it('marks fail below the pass mark', () => {
    const s = suggestGrade(withReview({ overallScore: ASSIGNMENT_PASS_MARK - 1 }));
    expect(s.passed).toBe(false);
    expect(s.suggestedScore).toBe(84);
  });

  it('clamps out-of-range scores and rounds to one decimal', () => {
    expect(suggestGrade(withReview({ overallScore: 140 })).suggestedScore).toBe(100);
    expect(suggestGrade(withReview({ overallScore: -5 })).suggestedScore).toBe(0);
    expect(suggestGrade(withReview({ overallScore: 82.47 })).suggestedScore).toBe(82.5);
  });

  it('flags plain-text responses (no JSON) as manual', () => {
    const s = suggestGrade({ id: 's2', status: 'submitted', response_text: 'My essay answer.', student: null });
    expect(s.source).toBe('manual');
    expect(s.suggestedScore).toBeNull();
    expect(s.passed).toBeNull();
    expect(s.studentName).toBe('Unknown');
  });

  it('flags a stored review with no overallScore as manual', () => {
    const s = suggestGrade(withReview({ executiveSummary: 'No score here.' }));
    expect(s.source).toBe('manual');
    expect(s.suggestedScore).toBeNull();
  });

  it('treats a null response_text as manual', () => {
    const s = suggestGrade({ id: 's3', status: 'submitted', response_text: null });
    expect(s.source).toBe('manual');
  });
});

describe('buildFeedbackFromReport', () => {
  it('includes the top recommendations when present', () => {
    const fb = buildFeedbackFromReport(
      { executiveSummary: 'Good.', topRecommendations: ['Do A', 'Do B', 'Do C', 'Do D'] },
      90,
    );
    expect(fb).toContain('90/100');
    expect(fb).toContain('1. Do A');
    expect(fb).toContain('3. Do C');
    expect(fb).not.toContain('Do D'); // capped at three
  });

  it('is robust to a report with no summary or recommendations', () => {
    const fb = buildFeedbackFromReport({}, 70);
    expect(fb).toContain('70/100');
  });
});
