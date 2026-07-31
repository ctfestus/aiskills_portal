-- 157: global XP is the best attempt per course, not the latest one.
--
-- The old rule was: per course, the best PASSING attempt -- or, if the student had never passed, the
-- most recently STARTED attempt. That second clause meant beginning a retake replaced a finished
-- attempt's points with the new attempt's (0 at the start), so a student watched their XP fall the
-- moment they clicked Retake and had to earn it back before seeing any gain.
--
-- Taking the highest points across all attempts instead:
--
--   * a retake can only ever improve the total, never reduce it;
--   * newly earned points still land immediately, without waiting for completion, because an
--     in-progress attempt is just another attempt;
--   * repeat attempts cannot farm XP, since the values are maxed rather than summed;
--   * the passed-versus-active precedence disappears, and with it a correlated subquery.
--
-- This is safe to apply: MAX over all attempts is always >= what the old rule produced (>= the best
-- passing attempt when one exists, >= the latest attempt otherwise), so the recompute below cannot
-- lower any student's total.
--
-- Note the guarantee is "a retake never reduces your global XP", not "XP never decreases": points
-- within a single attempt still fall when a student takes a hint or reveals a solution
-- (lib/attempt-points.ts). Those penalties are meant to bite.
--
-- Counting in-progress attempts is only safe because save-progress computes points server-side from
-- the stored answers rather than accepting the browser's running total. If that ever changes back,
-- this trigger must stop counting unfinished attempts.

CREATE OR REPLACE FUNCTION public.recalc_student_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := COALESCE(NEW.student_id, OLD.student_id);

  -- Student row is already gone (cascade delete in progress) -- nothing to update
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.student_xp (student_id, total_xp, updated_at)
  SELECT
    v_id,
    COALESCE((
      SELECT SUM(best_points) FROM (
        SELECT MAX(points) AS best_points
        FROM   public.course_attempts ca
        WHERE  ca.student_id = v_id
        GROUP  BY ca.course_id
      ) sub
    ), 0),
    now()
  ON CONFLICT (student_id) DO UPDATE
    SET total_xp   = EXCLUDED.total_xp,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recompute every student under the new rule. Non-decreasing, per the note above.
INSERT INTO public.student_xp (student_id, total_xp, updated_at)
SELECT s.id,
       COALESCE((
         SELECT SUM(best_points) FROM (
           SELECT MAX(points) AS best_points
           FROM   public.course_attempts ca
           WHERE  ca.student_id = s.id
           GROUP  BY ca.course_id
         ) sub
       ), 0),
       now()
FROM public.students s
ON CONFLICT (student_id) DO UPDATE
  SET total_xp   = EXCLUDED.total_xp,
      updated_at = now();
