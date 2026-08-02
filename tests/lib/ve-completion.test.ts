import { describe, it, expect } from 'vitest';

import {
  countCompletedRequirements, isVeComplete, veCompletionCounts,
  claimedSharesFromProgress, lessonCompletionPct, reqCountsForCompletion,
} from '@/lib/ve-completion';

const ve = (...requirements: any[]) => [{ lessons: [{ requirements }] }];
const claims = (...ids: string[]) => new Set(ids);

const task  = (id: string) => ({ id, type: 'task' });
const mcq   = (id: string) => ({ id, type: 'mcq', correctAnswer: 'A' });
/** Gating requires a deliberate `true` -- see unsetShare for what an untouched toggle produces. */
const share = (id: string) => ({ id, type: 'linkedin_share', shareRequired: true });
const optionalShare = (id: string) => ({ id, type: 'linkedin_share', shareRequired: false });
/** The flag never written: an author who added a share and left the toggle alone. */
const unsetShare = (id: string) => ({ id, type: 'linkedin_share' });

const complete = (modules: any[], progress: any, claimed?: Set<string>) =>
  isVeComplete(countCompletedRequirements(modules, progress, claimed));

describe('required linkedin_share (opt-in, never the default)', () => {
  it('blocks completion while unclaimed', () => {
    expect(complete(ve(task('t1'), share('s1')), { t1: { completed: true } }, claims())).toBe(false);
  });

  it('completes once claimed', () => {
    expect(complete(ve(task('t1'), share('s1')), { t1: { completed: true } }, claims('s1'))).toBe(true);
  });

  // The claim table is the authority: a client that simply asserts completed must not get through.
  // True for optional shares too -- optionality decides whether a share GATES, never whether an
  // unverified assertion counts as done.
  it('ignores a client-set completed flag with no claim behind it', () => {
    expect(complete(ve(task('t1'), share('s1')), { t1: { completed: true }, s1: { completed: true } }, claims()))
      .toBe(false);
  });

  // shareRequired is optional in the contract, and absent means OPTIONAL. The gate fails open on
  // purpose: nobody can exempt a student who has no LinkedIn account, so leaving the toggle untouched
  // must not be able to strand one. It drops out of the denominator like any other skipped optional
  // share, which is why totalReqs is 0 while authoredReqs still records that it exists.
  it('treats an absent shareRequired flag as optional', () => {
    expect(countCompletedRequirements(ve(unsetShare('s1')), {}, claims()))
      .toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 1 });
  });

  it('does not block a VE whose only share was left on the default', () => {
    expect(complete(ve(unsetShare('s1')), {}, claims())).toBe(true);
  });

  it('blocks a VE made only of an unclaimed required share', () => {
    expect(complete(ve(share('s1')), {}, claims())).toBe(false);
  });
});

// The point of the toggle: an optional share must never stand between a student and their
// certificate, however long they leave it unshared.
describe('optional linkedin_share', () => {
  it('does not block completion while unclaimed', () => {
    expect(complete(ve(task('t1'), optionalShare('s1')), { t1: { completed: true } }, claims())).toBe(true);
  });

  it('leaves the denominator entirely while unclaimed', () => {
    expect(countCompletedRequirements(ve(task('t1'), optionalShare('s1')), { t1: { completed: true } }, claims()))
      .toEqual({ totalReqs: 1, doneReqs: 1, authoredReqs: 2 });
  });

  it('counts once claimed, so the student sees credit for doing it', () => {
    const counts = countCompletedRequirements(ve(task('t1'), optionalShare('s1')), { t1: { completed: true } }, claims('s1'));
    expect(counts).toEqual({ totalReqs: 2, doneReqs: 2, authoredReqs: 2 });
    expect(isVeComplete(counts)).toBe(true);
  });

  it('still does not complete a VE whose other work is outstanding', () => {
    expect(complete(ve(task('t1'), optionalShare('s1')), {}, claims())).toBe(false);
  });

  // "Optional never blocks completion" has to hold even when it is the ONLY requirement -- nothing was
  // left blocking, so the VE is done.
  it('completes a VE made only of unclaimed optional shares', () => {
    const counts = countCompletedRequirements(ve(optionalShare('s1'), optionalShare('s2')), {}, claims());
    expect(counts).toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 2 });
    expect(isVeComplete(counts)).toBe(true);
  });

  it('is skipped, not credited, when the client merely asserts it is complete', () => {
    expect(countCompletedRequirements(ve(optionalShare('s1')), { s1: { completed: true } }, claims()))
      .toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 1 });
  });
});

// authoredReqs exists to separate these two cases, which both leave totalReqs at 0.
describe('a VE with nothing to do', () => {
  it('never auto-completes when no requirements are authored', () => {
    expect(isVeComplete({ totalReqs: 0, doneReqs: 0, authoredReqs: 0 })).toBe(false);
    expect(complete([{ lessons: [{ requirements: [] }] }], {})).toBe(false);
    expect(complete([], {})).toBe(false);
  });

  it('does complete when requirements exist but all were skippable and skipped', () => {
    expect(isVeComplete({ totalReqs: 0, doneReqs: 0, authoredReqs: 3 })).toBe(true);
  });
});

describe('other requirement types are unchanged', () => {
  it('validates mcq against correctAnswer, not the completed flag', () => {
    const modules = ve(mcq('m1'));
    expect(complete(modules, { m1: { completed: true, selectedAnswer: 'B' } })).toBe(false);
    expect(complete(modules, { m1: { selectedAnswer: 'A' } })).toBe(true);
  });

  it('trusts the completed flag for honour-system types', () => {
    expect(complete(ve(task('t1')), { t1: { completed: true } })).toBe(true);
    expect(complete(ve(task('t1')), { t1: { completed: false } })).toBe(false);
  });

  it('counts across modules and lessons', () => {
    const modules = [
      { lessons: [{ requirements: [task('a')] }, { requirements: [share('s1')] }] },
      { lessons: [{ requirements: [task('b')] }] },
    ];
    expect(countCompletedRequirements(modules, { a: { completed: true } }, claims('s1')))
      .toEqual({ totalReqs: 3, doneReqs: 2, authoredReqs: 3 });
  });

  it('skips an optional unclaimed share across modules too', () => {
    const modules = [
      { lessons: [{ requirements: [task('a')] }, { requirements: [optionalShare('s1')] }] },
      { lessons: [{ requirements: [task('b')] }] },
    ];
    expect(countCompletedRequirements(modules, { a: { completed: true } }, claims()))
      .toEqual({ totalReqs: 2, doneReqs: 1, authoredReqs: 3 });
  });

  it('tolerates missing modules, lessons and requirements', () => {
    expect(countCompletedRequirements([], {})).toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 0 });
    expect(countCompletedRequirements([{}], {})).toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 0 });
    expect(countCompletedRequirements([{ lessons: [{}] }], {})).toEqual({ totalReqs: 0, doneReqs: 0, authoredReqs: 0 });
  });
});

// The players cannot read linkedin_shares, so they derive the claim set from the flag the claim action
// wrote into progress. These helpers are what keep the browser and the server on one rule.
describe('client-side helpers mirror the server', () => {
  it('derives the claim set from progress', () => {
    const modules = ve(task('t1'), share('s1'), share('s2'));
    const set = claimedSharesFromProgress(modules, { t1: { completed: true }, s1: { completed: true } });
    expect([...set]).toEqual(['s1']);   // t1 is not a share; s2 has no progress
  });

  it('reaches the same verdict as the server for a required share', () => {
    const modules = ve(task('t1'), share('s1'));
    const progress = { t1: { completed: true } };
    expect(isVeComplete(veCompletionCounts(modules, progress))).toBe(false);
    expect(isVeComplete(veCompletionCounts(modules, { ...progress, s1: { completed: true } }))).toBe(true);
  });

  it('reaches the same verdict as the server for a skipped optional share', () => {
    const modules = ve(task('t1'), optionalShare('s1'));
    expect(isVeComplete(veCompletionCounts(modules, { t1: { completed: true } }))).toBe(true);
  });

  // This is the bug that let a skipped optional share pin the bar below 100% and keep Complete
  // disabled: the overall count must exclude it, exactly as the lesson count does.
  it('reports 100% overall when the only outstanding item is a skipped optional share', () => {
    const modules = ve(task('t1'), optionalShare('s1'));
    const counts = veCompletionCounts(modules, { t1: { completed: true } });
    expect(Math.round((counts.doneReqs / counts.totalReqs) * 100)).toBe(100);
  });

  it('gives a lesson percentage that ignores a skipped optional share', () => {
    const lesson = { requirements: [task('t1'), optionalShare('s1')] };
    expect(lessonCompletionPct(lesson, { t1: { completed: true } })).toBe(100);
    expect(lessonCompletionPct(lesson, {})).toBe(0);
  });

  it('treats a lesson with no requirements as complete', () => {
    expect(lessonCompletionPct({ requirements: [] }, {})).toBe(100);
  });

  it('excludes only skipped optional shares from the arrival gate', () => {
    expect(reqCountsForCompletion(optionalShare('s1'), {})).toBe(false);
    expect(reqCountsForCompletion(optionalShare('s1'), { s1: { completed: true } })).toBe(true);
    expect(reqCountsForCompletion(share('s1'), {})).toBe(true);
    expect(reqCountsForCompletion(task('t1'), {})).toBe(true);
  });
});
