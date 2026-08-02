-- Record how an account was created and whether it is allowed in, instead of inferring
-- both from the absence of other columns.
--
-- Why: /auth/callback used to decide "is this an unauthorised signup?" from missing
-- values (no cohort_id, no account_provisioned_at) and DELETE on that basis. Any column
-- that goes null became a deletion vector -- cohort_id is ON DELETE SET NULL, so
-- archiving one cohort turned every student in it into a deletion candidate. The same
-- fact was also reconstructed three different ways across the runtime, a migration, and
-- the callback, and those three definitions disagreed. Record it once instead.
--
-- account_origin: how the account came into existence. 'unknown' is a real answer for
--   everything that predates this migration -- their origin was never recorded and must
--   not be guessed from timestamps. Unknown accounts get the safe, non-destructive
--   treatment. See scripts/preview-password-setup-backfill.sql to classify them by hand.
--
-- access_state: whether the account may use the platform.
--   pending -- signed up, admission not yet resolved. The default for NEW rows.
--   active  -- allowed in.
--   denied  -- signup was not on any cohort allowlist. Kept, not deleted: losing a real
--              learner is unrecoverable, keeping a junk account is not.
--
-- The column defaults are deliberately split. Adding the column with DEFAULT 'active'
-- backfills every existing row to active in the same statement, with no window in which
-- the platform locks everyone out. The default is then switched to 'pending' so that
-- new rows -- including those created by the handle_new_user trigger on self-signup --
-- start unresolved and have to be admitted explicitly.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS account_origin text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS access_state   text NOT NULL DEFAULT 'active';

-- New rows start unresolved; existing rows keep the 'active' filled in above.
ALTER TABLE public.students
  ALTER COLUMN access_state SET DEFAULT 'pending';

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_account_origin_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_account_origin_check
  CHECK (account_origin IN ('self_signup', 'admissions', 'unknown'));

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_access_state_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_access_state_check
  CHECK (access_state IN ('pending', 'active', 'denied'));

-- Admin surfaces need to find unresolved and refused signups; active is the common case
-- and is deliberately excluded from the index.
CREATE INDEX IF NOT EXISTS idx_students_access_state
  ON public.students (access_state)
  WHERE access_state <> 'active';

-- The enforcement cache has to be written at the same moment as the row, or there is a
-- window where the database says 'pending' and the session's claims say nothing.
-- Absent claims are read as active on purpose -- every pre-migration account has none,
-- and treating absence as a restriction would lock the platform out -- so a new signup
-- with no claim would sail straight through the gate.
--
-- handle_new_user already runs SECURITY DEFINER on every auth.users insert, so it is
-- the one place guaranteed to see every account however it was created. Updating
-- auth.users from an AFTER INSERT trigger does not re-fire this trigger: it fires on
-- INSERT, not UPDATE.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.students (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    'student'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Mirror the students.access_state default into the claim the gate actually reads.
  -- lib/admit-students.ts flips this to active in the same request for an
  -- admissions-provisioned account; a self-signup stays pending until /auth/callback
  -- resolves it.
  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                             || '{"access_state": "pending"}'::jsonb
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

COMMIT;
