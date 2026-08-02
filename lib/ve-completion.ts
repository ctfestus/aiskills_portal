/**
 * Completion counting for a virtual experience -- the single rule shared by every surface.
 *
 * A VE is complete when every COUNTED requirement is done, which decides `completed_at`, the
 * certificate, learning-path progress, and whether the Complete button is enabled. Three places used
 * to compute this independently (the progress route, the assignment-completion route, and each
 * player's own progress bar) and they disagreed; everything now funnels through here.
 *
 * A LinkedIn Share deliverable only blocks the VE when the author deliberately gated it
 * (shareRequired === true); anything else, including an unset flag, is optional. That default is
 * chosen so a share added without touching the toggle cannot strand a student who has no LinkedIn
 * account -- there is no per-student exemption path. Every other requirement type always counts.
 * VE shares carry no XP either way.
 *
 * Requirement types are trusted differently on purpose:
 *   mcq             validated against correctAnswer -- the client's `completed` flag is ignored
 *   linkedin_share  validated against the claim table -- likewise ignored
 *   everything else honour-system: the client's `completed` flag is taken at face value
 */

export interface CompletionCounts {
  /** Requirements that must be done for this VE to complete. Excludes skipped optional shares. */
  totalReqs: number;
  doneReqs: number;
  /**
   * Every requirement that exists, counted or not.
   *
   * Needed to tell "this VE has no requirements at all" (must never auto-complete) apart from "every
   * requirement was an optional share the student skipped" (must complete). Both leave totalReqs at 0.
   */
  authoredReqs: number;
}

/**
 * An optional share the student has not claimed. It leaves the denominator entirely rather than
 * sitting unfinished, which is what stops it pinning a VE below 100%.
 *
 * The one place this rule is expressed. Callers differ only in where they learn `claimed` from: the
 * server reads the claim table, the client reads the flag the claim action wrote into progress.
 */
function isSkippedOptionalShare(req: any, claimed: boolean): boolean {
  return req?.type === 'linkedin_share' && req.shareRequired !== true && !claimed;
}

export function countCompletedRequirements(
  modules: any[],
  progress: any,
  claimedShareItemIds?: Set<string>,
): CompletionCounts {
  let totalReqs = 0;
  let doneReqs = 0;
  let authoredReqs = 0;

  for (const mod of modules ?? []) {
    for (const lesson of mod?.lessons ?? []) {
      for (const req of lesson?.requirements ?? []) {
        authoredReqs++;
        const entry = (progress ?? {})[req.id];

        if (req.type === 'linkedin_share') {
          // The claim table is the authority. A client that simply asserts `completed` for a share it
          // never made must not satisfy the requirement -- same reason mcq is checked against
          // correctAnswer rather than trusting the flag. True for optional shares too: optionality
          // decides whether a share GATES, never whether an unverified assertion counts as done.
          const claimed = !!claimedShareItemIds?.has(String(req.id));
          if (isSkippedOptionalShare(req, claimed)) continue;
          totalReqs++;
          if (claimed) doneReqs++;
          continue;
        }

        totalReqs++;
        if (!entry) continue;
        if (req.type === 'mcq') {
          if (entry.selectedAnswer === req.correctAnswer) doneReqs++;
        } else {
          if (entry.completed) doneReqs++;
        }
      }
    }
  }

  return { totalReqs, doneReqs, authoredReqs };
}

/**
 * True when every counted requirement is done.
 *
 * A VE with no requirements authored is NOT complete -- otherwise an empty or half-built VE would
 * complete itself on the student's first progress save. But a VE whose only requirements are optional
 * shares the student skipped IS complete: nothing was left blocking, which is the whole point of the
 * optional toggle.
 */
export function isVeComplete(counts: CompletionCounts): boolean {
  if (counts.authoredReqs === 0) return false;
  return counts.doneReqs >= counts.totalReqs;
}

/**
 * Client-side stand-in for the claim table.
 *
 * Only the server can read linkedin_shares, but the claim action writes `completed` into the
 * student's progress for the share it just recorded -- so on the client that flag IS the claim.
 * Deriving the set this way lets both players run the exact same rule as the server rather than
 * approximating it and drifting.
 */
export function claimedSharesFromProgress(modules: any[], progress: any): Set<string> {
  const ids = new Set<string>();
  for (const mod of modules ?? []) {
    for (const lesson of mod?.lessons ?? []) {
      for (const req of lesson?.requirements ?? []) {
        if (req?.type === 'linkedin_share' && (progress ?? {})[req.id]?.completed) ids.add(String(req.id));
      }
    }
  }
  return ids;
}

/** Counts across a whole VE from a player's local progress, for the bar and the Complete gate. */
export function veCompletionCounts(modules: any[], progress: any): CompletionCounts {
  return countCompletedRequirements(modules, progress, claimedSharesFromProgress(modules, progress));
}

/**
 * Display percentage for a whole VE, for cards, dashboards and reports.
 *
 * Deliberately mirrors isVeComplete so a card can never show "Completed" beside anything less than
 * 100%: a skipped optional share is excluded here exactly as it is from the gate. Reading the raw
 * requirement count instead is what produced "Completed / 50%".
 */
export function veProgressPct(modules: any[], progress: any): number {
  const counts = veCompletionCounts(modules, progress);
  if (counts.authoredReqs === 0) return 0;
  if (counts.totalReqs === 0) return 100;   // every requirement was skippable, and was skipped
  return Math.round((counts.doneReqs / counts.totalReqs) * 100);
}

/** Lesson completion percentage for the players. A lesson with nothing counted reads as 100%. */
export function lessonCompletionPct(lesson: any, progress: any): number {
  const counts = veCompletionCounts([{ lessons: [lesson] }], progress);
  return counts.totalReqs ? Math.round((counts.doneReqs / counts.totalReqs) * 100) : 100;
}

/**
 * Whether a requirement participates in completion, for per-requirement checks such as the players'
 * sequential-arrival gate. Client-side twin of the share branch above.
 */
export function reqCountsForCompletion(req: any, progress: any): boolean {
  const claimed = !!(progress ?? {})[req?.id]?.completed;
  return !isSkippedOptionalShare(req, claimed);
}
