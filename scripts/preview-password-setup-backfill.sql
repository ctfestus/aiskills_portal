-- MANUAL REVIEW SCRIPT. Not a migration. Never run by a migration runner.
--
-- Run these by hand in the Supabase SQL editor when you are ready to classify the
-- accounts that predate the account_origin model (migration 159). They read only.
--
-- CONTAINS PII: student emails and user ids. Do not paste the output into shared logs,
-- tickets, or deployment output.
--
-- Background. Migration 159 records how an account was created:
--   account_origin = 'self_signup' | 'admissions' | 'unknown'
-- Every account that existed before that migration is backfilled to 'unknown' and left
-- 'active', because their true origin is not recorded anywhere and must not be guessed.
--
-- An earlier draft of this backfill flipped a password-setup claim using:
--     account_provisioned_at IS NOT NULL AND password_set_at IS NULL
-- That condition is WRONG and must never be used. lib/admit-students.ts also stamps
-- account_provisioned_at on accounts that ALREADY existed (the else branch, where a
-- current student or staff member is admitted to another cohort), and password_set_at
-- is only ever written by the new setup form, so it is null for every account
-- predating this work. The condition matches long-standing users and would force them
-- to reset a password that works.
--
-- origin_guess below is a HINT FOR HUMAN REVIEW, not evidence. It is a timestamp
-- correlation. Anything not confidently identified as admissions-created must stay
-- 'unknown'. Reclassify individual accounts deliberately; do not mass-update.

-- 1. How many accounts are in scope at all?
SELECT count(*) AS candidate_rows
  FROM public.students s
  JOIN auth.users u ON u.id = s.id
 WHERE s.account_provisioned_at IS NOT NULL
   AND s.password_set_at IS NULL;

-- 2. The candidates, with the evidence needed to judge each one.
--    An account created BY the admissions pipeline has its auth user and its
--    account_provisioned_at stamp written moments apart, because lib/admit-students.ts
--    calls createUser and then immediately upserts the profile. A pre-existing account
--    later admitted to a cohort has an auth user far older than the stamp.
SELECT
  s.id,
  s.email,
  s.role,
  s.account_origin,
  s.access_state,
  s.account_provisioned_at,
  s.password_set_at,
  s.onboarding_done,
  s.last_login_at,
  u.created_at                                AS auth_user_created_at,
  u.last_sign_in_at,
  age(s.account_provisioned_at, u.created_at) AS stamp_minus_signup,
  CASE
    WHEN u.created_at BETWEEN s.account_provisioned_at - interval '2 minutes'
                          AND s.account_provisioned_at + interval '2 minutes'
      THEN 'likely admissions-created -- review'
    ELSE 'AMBIGUOUS: pre-existing account later admitted -- leave unknown'
  END AS origin_guess
FROM public.students s
JOIN auth.users u ON u.id = s.id
WHERE s.account_provisioned_at IS NOT NULL
  AND s.password_set_at IS NULL
ORDER BY origin_guess, s.account_provisioned_at;
