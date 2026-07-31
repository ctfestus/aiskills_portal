/**
 * Server-side XP calculation for a course attempt -- the single implementation used by BOTH
 * save-progress (mid-course) and complete-attempt (final).
 *
 * The browser reports a running points total as the student answers, and `course_attempts.points`
 * feeds `student_xp` through the recalc_student_xp trigger, so that total reaches the leaderboard.
 * Trusting it meant a student could report the course maximum without answering anything. Rather than
 * withhold XP until submission, both paths now compute it here from the answers actually stored, so
 * mid-course XP still counts and is still the server's number.
 *
 * Extracted rather than duplicated: complete-attempt owned this logic, and a second copy in
 * save-progress would drift -- the two would then disagree about a student's XP at the moment they
 * submitted, which is exactly the sort of discrepancy nobody notices until a student complains.
 */

import { parseAnswer } from '@/lib/grade-question';
import { linkedInSharePointsFor, type PointsSystem } from '@/lib/course-schema';

/** A slide that carries a gradeable answer. Sections, lessons, downloads and shares never score. */
export function isScorableQuestion(q: any): boolean {
  return !!q && !q.lessonOnly && !q.isSection && !q.isDownloads && !q.isLinkedInShare;
}

export interface AttemptPointsInput {
  questions: any[];
  /** The attempt's stored answers, including `__meta_<id>` timing entries. */
  storedAnswers: Record<string, string>;
  hintsUsed: string[];
  pointsSystem: PointsSystem;
  /**
   * Share slides this student holds a claim for, from linkedin_shares. The claim table is the
   * authority: a URL sitting in `answers` with no claim behind it earns nothing.
   */
  claimedShareItemIds: Set<string>;
  /** Grading is caller-supplied because SQL/Python answers need HMAC proof verification. */
  isCorrect: (question: any) => boolean;
}

/**
 * Points earned so far on an attempt.
 *
 * Order matters: streaks are counted in the order the student actually answered (from the `__meta_`
 * timestamps), not in slide order, so the same answers always produce the same total whether they are
 * scored mid-course or at submission.
 */
export function computeAttemptPoints(input: AttemptPointsInput): number {
  const { questions, storedAnswers, hintsUsed, pointsSystem, claimedShareItemIds, isCorrect } = input;
  if (!pointsSystem.enabled) return 0;

  const metaFor = (q: any) => {
    const parsed = parseAnswer(storedAnswers[q.id]) ?? {};
    const meta = parseAnswer(storedAnswers[`__meta_${q.id}`]) ?? {};
    const elapsed = Number(meta.elapsedSeconds ?? parsed.elapsedSeconds);
    const answeredAtRaw = meta.answeredAt ?? parsed.answeredAt ?? parsed.checkedAt;
    const answeredAtMs = answeredAtRaw ? Date.parse(String(answeredAtRaw)) : NaN;
    return {
      parsed,
      elapsedSeconds: Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null,
      answeredAtMs: Number.isFinite(answeredAtMs) ? answeredAtMs : null,
    };
  };

  const earnedFor = (q: any, pointStreak: number, elapsedSeconds: number | null) => {
    const withinTimeBonus = pointsSystem.timeBonusEnabled
      && elapsedSeconds != null
      && elapsedSeconds <= pointsSystem.timeBonusSeconds;
    const timeMultiplier = withinTimeBonus ? pointsSystem.timeBonusMultiplier : 1;
    let earned = Math.round(pointsSystem.basePoints * timeMultiplier);
    const isStreak = pointsSystem.streakEnabled && pointStreak >= pointsSystem.streakCount;
    if (isStreak) {
      earned = pointsSystem.streakBonus > 0
        ? earned + pointsSystem.streakBonus
        : Math.round(earned * 1.2);
    }
    if (hintsUsed.includes(q.id)) earned = Math.max(0, earned - pointsSystem.hintPenalty);
    return earned;
  };

  const scorable = (questions ?? []).filter(isScorableQuestion);

  const events = scorable
    .map((q, index) => {
      const meta = metaFor(q);
      return {
        q,
        index,
        raw: storedAnswers[q.id],
        correct: isCorrect(q),
        solutionViewed: !!meta.parsed?.solutionViewed,
        elapsedSeconds: meta.elapsedSeconds,
        answeredAtMs: meta.answeredAtMs,
      };
    })
    .filter(e => e.raw != null)
    .sort((a, b) =>
      (a.answeredAtMs ?? Number.POSITIVE_INFINITY) - (b.answeredAtMs ?? Number.POSITIVE_INFINITY)
      || a.index - b.index);

  let points = 0;
  let pointStreak = 0;
  for (const event of events) {
    if (event.correct) {
      pointStreak += 1;
      points += earnedFor(event.q, pointStreak, event.elapsedSeconds);
    } else {
      pointStreak = 0;
      if (event.solutionViewed) points = Math.max(0, points - pointsSystem.solutionPenalty);
    }
  }

  // LinkedIn share bonuses. Gated on a claim, never on the URL in `answers`.
  for (const q of questions ?? []) {
    if (!q?.isLinkedInShare) continue;
    if (!claimedShareItemIds.has(String(q.id))) continue;
    points += linkedInSharePointsFor(q);
  }

  return Math.max(0, Math.round(points));
}
