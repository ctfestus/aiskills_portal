// Pure helpers for bulk-grading assignments from the AI-review score a student's
// submission already carries. Review-type assignments (document / excel / code /
// dashboard-critique) persist their AI report in the submission via the canonical
// envelope in `lib/reviewRecord.ts`, and `report.overallScore` is a 0-100 score.
// Bulk grading reuses that score instead of re-running any AI, so it is instant and free.
//
// No Supabase / React imports here so the route and tests can import it directly.

import { parseReviewNotes } from './reviewRecord';

// Assignments pass at 85 across the app (see components/dashboard/AssignmentsManageSection).
export const ASSIGNMENT_PASS_MARK = 85;

// Where a suggested score came from.
export type GradeSource = 'ai-review' | 'manual';

export interface GradeSuggestion {
  submissionId:  string;
  studentName:   string;
  studentEmail:  string;
  status:        string;
  suggestedScore: number | null;  // 0-100, or null when it needs a human
  passed:        boolean | null;  // vs ASSIGNMENT_PASS_MARK, null when no score
  feedback:      string;
  source:        GradeSource;
  note?:         string;          // why it needs manual grading
}

export interface SubmissionForGrading {
  id:            string;
  status:        string;
  response_text: string | null;
  student?:      { full_name?: string | null; email?: string | null } | null;
}

// Pull a clean 0-100 score out of a persisted AI report, or null when absent/invalid.
function scoreFromReport(report: unknown): number | null {
  if (!report || typeof report !== 'object') return null;
  const raw = (report as { overallScore?: unknown }).overallScore;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped * 10) / 10; // one decimal, matches the manual grader's display
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function firstStringArray(...vals: unknown[]): string[] {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const items = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      if (items.length) return items;
    }
  }
  return [];
}

// Compose plain-text feedback from whatever the report exposes. Defensive across the
// different report shapes (document / excel / code / dashboard) which do not share every field.
export function buildFeedbackFromReport(report: unknown, score: number): string {
  const r = (report && typeof report === 'object') ? (report as Record<string, unknown>) : {};
  const summary = firstString(r.executiveSummary, r.summary);
  const recs    = firstStringArray(r.topRecommendations, r.recommendations).slice(0, 3);

  const lines: string[] = [`Auto-suggested from the student's AI review score: ${score}/100.`];
  if (summary) lines.push('', summary);
  if (recs.length) {
    lines.push('', 'Top improvements:');
    recs.forEach((rec, i) => lines.push(`${i + 1}. ${rec}`));
  }
  return lines.join('\n');
}

// Turn one submission into a grade suggestion. Never throws.
export function suggestGrade(sub: SubmissionForGrading): GradeSuggestion {
  const studentName  = sub.student?.full_name ?? 'Unknown';
  const studentEmail = sub.student?.email ?? '';
  const base = { submissionId: sub.id, studentName, studentEmail, status: sub.status };

  const rec   = parseReviewNotes(sub.response_text);
  const score = rec ? scoreFromReport(rec.report) : null;

  if (score == null) {
    return {
      ...base,
      suggestedScore: null,
      passed:         null,
      feedback:       '',
      source:         'manual',
      note: rec
        ? 'AI review has no overall score; grade manually.'
        : 'Free-form or multi-part response with no stored AI score; grade manually.',
    };
  }

  return {
    ...base,
    suggestedScore: score,
    passed:         score >= ASSIGNMENT_PASS_MARK,
    feedback:       buildFeedbackFromReport(rec!.report, score),
    source:         'ai-review',
  };
}
